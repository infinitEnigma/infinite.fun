// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ILaunchpadFactory {
    function onGraduated(address curve) external;
}

interface IPlatformTreasury {
    function platformFeeBps() external view returns (uint256);
    function recordReceipt(uint256 amount, string calldata reason) external;
}

/// @title infinite.fun Bonding Curve
/// @notice Constant-product bonding curve trading token against USDC.
///
/// @dev Fee structure (applied to every swap):
///   - platformFeeBps (default 20 bps = 0.20%) sent directly to PlatformTreasury.
///   - Remaining fee (1% total minus platform cut) accumulates for SubWallet to claim.
///
/// Total swap fee is always 1% of USDC involved. Platform takes its cut first;
/// the SubWallet receives the net remainder via claimFees().
contract BondingCurve {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    IERC20 public immutable usdc;
    address public immutable subWallet;
    address public immutable factory;
    address public immutable platformTreasury;

    uint256 public virtualTokenReserve;
    uint256 public virtualUsdcReserve;
    uint256 public realUsdcCollected;
    uint256 public accumulatedFees;        // net fees claimable by SubWallet
    uint256 public totalPlatformFees;      // lifetime platform fees sent to treasury
    bool public graduated;
    uint256 public graduationThreshold;

    /// @dev Total fee on every swap is 100 bps (1%).
    uint256 public constant TOTAL_FEE_BPS = 100;

    error SlippageExceeded();
    error NotSubWallet();
    error InvalidAmount();
    error AlreadyGraduated();

    event TokensPurchased(address indexed buyer, uint256 usdcIn, uint256 tokensOut, uint256 subFee, uint256 platformFee);
    event TokensSold(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 subFee, uint256 platformFee);
    event FeesClaimed(uint256 amount);
    event Graduated(address indexed token, uint256 usdcCollected);

    /// @notice Initializes the bonding curve with virtual reserves.
    /// @param _token Token traded on this curve.
    /// @param _usdc USDC token address (6 decimals).
    /// @param _subWallet SubWallet authorized to claim net fees.
    /// @param _factory LaunchpadFactory notified on graduation.
    /// @param _platformTreasury PlatformTreasury that receives the platform cut.
    /// @param _graduationThreshold Threshold in USDC 6-decimal units.
    constructor(
        address _token,
        address _usdc,
        address _subWallet,
        address _factory,
        address _platformTreasury,
        uint256 _graduationThreshold
    ) {
        token = IERC20(_token);
        usdc = IERC20(_usdc);
        subWallet = _subWallet;
        factory = _factory;
        platformTreasury = _platformTreasury;
        graduationThreshold = _graduationThreshold;

        virtualTokenReserve = 1_000_000_000e18;
        virtualUsdcReserve = 1e6;
    }

    modifier onlySubWallet() {
        if (msg.sender != subWallet) revert NotSubWallet();
        _;
    }

    // -------------------------------------------------------------------------
    // Trading
    // -------------------------------------------------------------------------

    /// @notice Buys launch tokens with USDC.
    /// @param usdcIn USDC amount in (6 decimals).
    /// @param minTokensOut Minimum acceptable tokens out (slippage guard).
    /// @return tokensOut Amount of tokens received.
    function buyTokens(uint256 usdcIn, uint256 minTokensOut) external returns (uint256 tokensOut) {
        if (usdcIn == 0) revert InvalidAmount();
        if (graduated) revert AlreadyGraduated();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        // Split 1% total fee: platform cut first, remainder to SubWallet pool.
        uint256 platformBps = IPlatformTreasury(platformTreasury).platformFeeBps();
        uint256 platformFee = (usdcIn * platformBps) / 10_000;
        uint256 totalFee    = (usdcIn * TOTAL_FEE_BPS) / 10_000;
        uint256 subFee      = totalFee - platformFee;
        uint256 usdcAfterFee = usdcIn - totalFee;

        tokensOut = (virtualTokenReserve * usdcAfterFee) / (virtualUsdcReserve + usdcAfterFee);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        virtualTokenReserve  -= tokensOut;
        virtualUsdcReserve   += usdcAfterFee;
        accumulatedFees      += subFee;
        totalPlatformFees    += platformFee;
        realUsdcCollected    += usdcAfterFee;

        // Push platform cut immediately to treasury.
        if (platformFee > 0) {
            usdc.safeTransfer(platformTreasury, platformFee);
            IPlatformTreasury(platformTreasury).recordReceipt(platformFee, "platform_swap");
        }

        token.safeTransfer(msg.sender, tokensOut);

        if (!graduated && realUsdcCollected >= graduationThreshold) {
            _graduate();
        }

        emit TokensPurchased(msg.sender, usdcIn, tokensOut, subFee, platformFee);
    }

    /// @notice Sells launch tokens for USDC.
    /// @param tokensIn Token amount in (18 decimals).
    /// @param minUsdcOut Minimum acceptable USDC out (slippage guard).
    /// @return usdcOut Net USDC amount out after fee.
    function sellTokens(uint256 tokensIn, uint256 minUsdcOut) external returns (uint256 usdcOut) {
        if (tokensIn == 0) revert InvalidAmount();
        if (graduated) revert AlreadyGraduated();

        token.safeTransferFrom(msg.sender, address(this), tokensIn);

        uint256 grossUsdcOut = (virtualUsdcReserve * tokensIn) / (virtualTokenReserve + tokensIn);

        uint256 platformBps = IPlatformTreasury(platformTreasury).platformFeeBps();
        uint256 platformFee = (grossUsdcOut * platformBps) / 10_000;
        uint256 totalFee    = (grossUsdcOut * TOTAL_FEE_BPS) / 10_000;
        uint256 subFee      = totalFee - platformFee;
        usdcOut             = grossUsdcOut - totalFee;

        if (usdcOut < minUsdcOut) revert SlippageExceeded();

        virtualTokenReserve += tokensIn;
        virtualUsdcReserve  -= grossUsdcOut;
        accumulatedFees     += subFee;
        totalPlatformFees   += platformFee;

        // Push platform cut to treasury.
        if (platformFee > 0) {
            usdc.safeTransfer(platformTreasury, platformFee);
            IPlatformTreasury(platformTreasury).recordReceipt(platformFee, "platform_swap");
        }

        usdc.safeTransfer(msg.sender, usdcOut);

        emit TokensSold(msg.sender, tokensIn, usdcOut, subFee, platformFee);
    }

    // -------------------------------------------------------------------------
    // Fee claim (SubWallet only)
    // -------------------------------------------------------------------------

    /// @notice Claims accumulated net trading fees to the SubWallet.
    /// @return fees Claimed USDC fee amount.
    function claimFees() external onlySubWallet returns (uint256 fees) {
        fees = accumulatedFees;
        if (fees == 0) return 0;
        accumulatedFees = 0;
        usdc.safeTransfer(subWallet, fees);
        emit FeesClaimed(fees);
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Returns current spot price as USDC-per-token with 1e18 precision.
    function getPrice() external view returns (uint256 price) {
        price = (virtualUsdcReserve * 1e18) / virtualTokenReserve;
    }

    /// @notice Quotes token output for a given USDC input (after total 1% fee).
    /// @param usdcIn USDC input amount (6 decimals).
    /// @return tokensOut Estimated token output.
    function getTokensOut(uint256 usdcIn) external view returns (uint256 tokensOut) {
        uint256 usdcAfterFee = usdcIn - (usdcIn * TOTAL_FEE_BPS) / 10_000;
        tokensOut = (virtualTokenReserve * usdcAfterFee) / (virtualUsdcReserve + usdcAfterFee);
    }

    /// @notice Quotes USDC output for a given token input (after total 1% fee).
    /// @param tokensIn Token input amount (18 decimals).
    /// @return usdcOut Estimated USDC output.
    function getUsdcOut(uint256 tokensIn) external view returns (uint256 usdcOut) {
        uint256 gross = (virtualUsdcReserve * tokensIn) / (virtualTokenReserve + tokensIn);
        usdcOut = gross - (gross * TOTAL_FEE_BPS) / 10_000;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _graduate() internal {
        graduated = true;
        emit Graduated(address(token), realUsdcCollected);
        ILaunchpadFactory(factory).onGraduated(address(this));
    }
}
