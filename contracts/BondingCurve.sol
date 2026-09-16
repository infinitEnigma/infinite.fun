// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILaunchpadFactory {
    function onGraduated(address curve) external;
}

/// @title infinite.fun Bonding Curve
/// @notice Constant-product bonding curve trading token against USDC.
contract BondingCurve {
    IERC20 public immutable token;
    IERC20 public immutable usdc;
    address public immutable subWallet;
    address public immutable factory;

    uint256 public virtualTokenReserve;
    uint256 public virtualUsdcReserve;
    uint256 public realUsdcCollected;
    uint256 public accumulatedFees;
    bool public graduated;
    uint256 public graduationThreshold;

    error SlippageExceeded();
    error TransferFailed();
    error NotSubWallet();
    error InvalidAmount();

    event TokensPurchased(address indexed buyer, uint256 usdcIn, uint256 tokensOut, uint256 fee);
    event TokensSold(address indexed seller, uint256 tokensIn, uint256 usdcOut, uint256 fee);
    event FeesClaimed(uint256 amount);
    event Graduated(address indexed token, uint256 usdcCollected);

    /// @notice Initializes the bonding curve with virtual reserves.
    /// @param _token Token traded on this curve.
    /// @param _usdc USDC token address (6 decimals).
    /// @param _subWallet SubWallet authorized to claim fees.
    /// @param _factory LaunchpadFactory notified on graduation.
    /// @param _graduationThreshold Threshold in USDC 6-decimal units.
    constructor(address _token, address _usdc, address _subWallet, address _factory, uint256 _graduationThreshold) {
        token = IERC20(_token);
        usdc = IERC20(_usdc);
        subWallet = _subWallet;
        factory = _factory;
        graduationThreshold = _graduationThreshold;

        virtualTokenReserve = 1_000_000_000e18;
        virtualUsdcReserve = 1e6;
    }

    modifier onlySubWallet() {
        if (msg.sender != subWallet) revert NotSubWallet();
        _;
    }

    /// @notice Buys launch tokens with USDC.
    /// @param usdcIn USDC amount in (6 decimals).
    /// @param minTokensOut Minimum acceptable tokens out.
    /// @return tokensOut Amount of tokens received.
    function buyTokens(uint256 usdcIn, uint256 minTokensOut) external returns (uint256 tokensOut) {
        if (usdcIn == 0) revert InvalidAmount();
        if (!usdc.transferFrom(msg.sender, address(this), usdcIn)) revert TransferFailed();

        uint256 feeAmount = usdcIn / 100;
        uint256 usdcAfterFee = usdcIn - feeAmount;

        tokensOut = (virtualTokenReserve * usdcAfterFee) / (virtualUsdcReserve + usdcAfterFee);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        virtualTokenReserve -= tokensOut;
        virtualUsdcReserve += usdcAfterFee;
        accumulatedFees += feeAmount;
        realUsdcCollected += usdcAfterFee;

        if (!token.transfer(msg.sender, tokensOut)) revert TransferFailed();

        if (!graduated && realUsdcCollected >= graduationThreshold) {
            _graduate();
        }

        emit TokensPurchased(msg.sender, usdcIn, tokensOut, feeAmount);
    }

    /// @notice Sells launch tokens for USDC.
    /// @param tokensIn Token amount in (18 decimals).
    /// @param minUsdcOut Minimum acceptable USDC out.
    /// @return usdcOut Net USDC amount out after fee.
    function sellTokens(uint256 tokensIn, uint256 minUsdcOut) external returns (uint256 usdcOut) {
        if (tokensIn == 0) revert InvalidAmount();
        if (!token.transferFrom(msg.sender, address(this), tokensIn)) revert TransferFailed();

        uint256 grossUsdcOut = (virtualUsdcReserve * tokensIn) / (virtualTokenReserve + tokensIn);
        uint256 feeAmount = grossUsdcOut / 100;
        usdcOut = grossUsdcOut - feeAmount;

        if (usdcOut < minUsdcOut) revert SlippageExceeded();

        virtualTokenReserve += tokensIn;
        virtualUsdcReserve -= grossUsdcOut;
        accumulatedFees += feeAmount;

        if (!usdc.transfer(msg.sender, usdcOut)) revert TransferFailed();

        emit TokensSold(msg.sender, tokensIn, usdcOut, feeAmount);
    }

    /// @notice Claims accumulated trading fees to the SubWallet.
    /// @return fees Claimed USDC fee amount.
    function claimFees() external onlySubWallet returns (uint256 fees) {
        fees = accumulatedFees;
        if (fees == 0) return 0;

        accumulatedFees = 0;
        if (!usdc.transfer(subWallet, fees)) revert TransferFailed();

        emit FeesClaimed(fees);
    }

    /// @notice Returns current spot price as USDC-per-token with 1e18 precision.
    /// @return price Price in USDC units scaled by 1e18.
    function getPrice() external view returns (uint256 price) {
        price = (virtualUsdcReserve * 1e18) / virtualTokenReserve;
    }

    /// @notice Quotes token output for a USDC input, excluding protocol fee.
    /// @param usdcIn USDC input amount.
    /// @return tokensOut Quoted token output.
    function getTokensOut(uint256 usdcIn) external view returns (uint256 tokensOut) {
        tokensOut = (virtualTokenReserve * usdcIn) / (virtualUsdcReserve + usdcIn);
    }

    /// @notice Marks this curve as graduated and notifies the factory.
    function _graduate() internal {
        graduated = true;
        emit Graduated(address(token), realUsdcCollected);
        ILaunchpadFactory(factory).onGraduated(address(this));
    }
}
