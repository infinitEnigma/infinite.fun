// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IHyperliquidBridge} from "./interfaces/IHyperliquidBridge.sol";

interface ITokenBurn {
    function burn(address from, uint256 amount) external;
}

interface IBondingCurveWithClaim {
    /// @dev Returns the USDC amount claimed.
    function claimFees() external returns (uint256 fees);
    function buyTokens(uint256 usdcIn, uint256 minTokensOut) external returns (uint256 tokensOut);
    function getPrice() external view returns (uint256);
}

interface IKeeperRegistry {
    function getCoinCurve(address coin) external view returns (address curve);
}

/// @title infinite.fun SubWallet
/// @notice Per-coin USDC treasury and keeper-executed strategy wallet.
contract SubWallet {
    using SafeERC20 for IERC20;

    address public coin;
    address public keeper;
    address public factory;
    address public registry;
    bytes32 public positionId;
    bool public positionOpen;
    uint256 public totalCollateral;
    uint256 public totalBurned;
    uint256 public totalPnlRealized;
    address public immutable usdc;

    /// @notice Allowlisted treasury address for emergency withdrawals.
    address public emergencyTreasury;

    error NotKeeper();
    error ZeroAddress();
    error PositionNotInitialized();
    error PositionAlreadyOpen();
    error BuybackSlippageZero();

    event FeeClaimed(
        uint256 feeAmount,
        uint256 perpSlice,
        uint256 creatorSlice,
        uint256 treasurySlice,
        uint256 destSlice
    );
    event ProfitTaken(uint256 realizedPnl, uint256 burned, uint256 treasurySlice);
    event BuybackBurned(uint256 usdcSpent, uint256 tokensBurned);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);

    /// @notice Initializes the SubWallet.
    /// @param _coin Coin token address.
    /// @param _keeper Keeper authority.
    /// @param _factory LaunchpadFactory address.
    /// @param _registry KeeperRegistry address.
    /// @param _usdc USDC token address.
    constructor(address _coin, address _keeper, address _factory, address _registry, address _usdc) {
        if (
            _coin == address(0) || _keeper == address(0) || _factory == address(0)
                || _registry == address(0) || _usdc == address(0)
        ) revert ZeroAddress();

        coin = _coin;
        keeper = _keeper;
        factory = _factory;
        registry = _registry;
        usdc = _usdc;
        emergencyTreasury = _keeper; // default to keeper; updateable via setEmergencyTreasury
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /// @notice Sets the strategy position ID used for margin updates and partial closes.
    /// @param _positionId Hyperliquid position identifier.
    function setPositionId(bytes32 _positionId) external onlyKeeper {
        positionId = _positionId;
    }

    /// @notice Updates the keeper address. Emits KeeperUpdated.
    /// @param newKeeper Replacement keeper address.
    function setKeeper(address newKeeper) external onlyKeeper {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Updates the emergency treasury (only allowlisted recipient for withdrawTo).
    /// @param newTreasury New emergency treasury address.
    function setEmergencyTreasury(address newTreasury) external onlyKeeper {
        if (newTreasury == address(0)) revert ZeroAddress();
        emergencyTreasury = newTreasury;
    }

    // -------------------------------------------------------------------------
    // Keeper loop
    // -------------------------------------------------------------------------

    /// @notice Claims fee USDC from the curve via claimFees() and splits 50/15/20/15.
    /// @dev Calls BondingCurve.claimFees() which pushes USDC to this contract directly.
    /// @param creatorFeeRecipient Recipient for creator fee share (15%).
    /// @param treasury Recipient for treasury fee share (20%).
    /// @param feeDest Destination for the final 15% slice.
    /// @param burnMode When true, the dest slice is used for immediate buyback+burn.
    /// @param minTokensOut Minimum tokens out for buyback (slippage guard); pass 0 to skip.
    function claimAndSplit(
        address creatorFeeRecipient,
        address treasury,
        address feeDest,
        bool burnMode,
        uint256 minTokensOut
    ) external onlyKeeper {
        if (creatorFeeRecipient == address(0) || treasury == address(0) || feeDest == address(0)) {
            revert ZeroAddress();
        }

        address curve = IKeeperRegistry(registry).getCoinCurve(coin);
        // Pull fees: BondingCurve.claimFees() resets accumulatedFees and pushes USDC here.
        uint256 feeAmount = IBondingCurveWithClaim(curve).claimFees();
        if (feeAmount == 0) return;

        uint256 perpSlice = (feeAmount * 50) / 100;
        uint256 creatorSlice = (feeAmount * 15) / 100;
        uint256 treasurySlice = (feeAmount * 20) / 100;
        // Remainder avoids dust from integer division.
        uint256 destSlice = feeAmount - perpSlice - creatorSlice - treasurySlice;

        IERC20 usdcToken = IERC20(usdc);
        usdcToken.safeTransfer(creatorFeeRecipient, creatorSlice);
        usdcToken.safeTransfer(treasury, treasurySlice);

        if (burnMode && destSlice > 0) {
            _buybackAndBurn(destSlice, curve, minTokensOut);
        }
        // perpSlice stays in SubWallet as collateral buffer for openPosition / addMargin.

        emit FeeClaimed(feeAmount, perpSlice, creatorSlice, treasurySlice, destSlice);
    }

    /// @notice Opens a leveraged position via Hyperliquid bridge. Can only be called once.
    /// @param usdcAmount USDC collateral amount.
    /// @param leverage Desired leverage.
    /// @param isLong True for long, false for short.
    /// @param hyperliquidBridge Bridge contract to execute against.
    function openPosition(uint256 usdcAmount, uint64 leverage, bool isLong, address hyperliquidBridge)
        external
        onlyKeeper
    {
        if (hyperliquidBridge == address(0)) revert ZeroAddress();
        if (positionOpen) revert PositionAlreadyOpen();

        IERC20 usdcToken = IERC20(usdc);
        usdcToken.forceApprove(hyperliquidBridge, usdcAmount);
        IHyperliquidBridge(hyperliquidBridge).depositAndBuy(usdc, usdcAmount, leverage, isLong);
        usdcToken.forceApprove(hyperliquidBridge, 0);

        positionOpen = true;
        totalCollateral += usdcAmount;
    }

    /// @notice Adds margin to an existing position.
    /// @param usdcAmount USDC amount to add.
    /// @param hyperliquidBridge Bridge contract.
    function addMargin(uint256 usdcAmount, address hyperliquidBridge) external onlyKeeper {
        if (hyperliquidBridge == address(0)) revert ZeroAddress();
        if (positionId == bytes32(0)) revert PositionNotInitialized();

        IERC20 usdcToken = IERC20(usdc);
        usdcToken.forceApprove(hyperliquidBridge, usdcAmount);
        IHyperliquidBridge(hyperliquidBridge).addMargin(positionId, usdcAmount);
        usdcToken.forceApprove(hyperliquidBridge, 0);

        totalCollateral += usdcAmount;
    }

    /// @notice Takes profit on 25% of position and routes proceeds 75% burn / 25% treasury.
    /// @param hyperliquidBridge Bridge contract.
    /// @param treasury Treasury recipient for 25% of realized PnL.
    /// @param minTokensOut Minimum tokens out for buyback (slippage guard).
    function takeProfitSlice(address hyperliquidBridge, address treasury, uint256 minTokensOut)
        external
        onlyKeeper
    {
        if (hyperliquidBridge == address(0) || treasury == address(0)) revert ZeroAddress();
        if (positionId == bytes32(0)) revert PositionNotInitialized();

        uint256 realizedPnl = IHyperliquidBridge(hyperliquidBridge).closePartial(positionId, 0.25e18);
        totalPnlRealized += realizedPnl;

        uint256 burnUsdc = (realizedPnl * 75) / 100;
        uint256 treasurySlice = realizedPnl - burnUsdc;

        address curve = IKeeperRegistry(registry).getCoinCurve(coin);
        uint256 burned = 0;
        if (burnUsdc > 0) {
            burned = _buybackAndBurn(burnUsdc, curve, minTokensOut);
        }

        if (treasurySlice > 0) {
            IERC20 usdcToken2 = IERC20(usdc);
            usdcToken2.safeTransfer(treasury, treasurySlice);
        }

        emit ProfitTaken(realizedPnl, burned, treasurySlice);
    }

    /// @notice Executes a standalone USDC buyback through the curve and burns acquired tokens.
    /// @param usdcAmount USDC amount to spend.
    /// @param bondingCurve Curve address.
    /// @param minTokensOut Slippage guard — minimum tokens out.
    function executeBuyback(uint256 usdcAmount, address bondingCurve, uint256 minTokensOut)
        external
        onlyKeeper
    {
        uint256 burned = _buybackAndBurn(usdcAmount, bondingCurve, minTokensOut);
        emit BuybackBurned(usdcAmount, burned);
    }

    /// @notice Emergency withdrawal of USDC — restricted to allowlisted emergencyTreasury.
    /// @param amount USDC amount.
    function withdrawTo(uint256 amount) external onlyKeeper {
        IERC20 usdcToken = IERC20(usdc);
        usdcToken.safeTransfer(emergencyTreasury, amount);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    /// @notice Buys tokens on the curve and burns them. Clears approval after call.
    /// @param usdcAmount USDC to spend.
    /// @param bondingCurve Curve address.
    /// @param minTokensOut Slippage floor.
    /// @return tokensBurned Tokens acquired then burned.
    function _buybackAndBurn(uint256 usdcAmount, address bondingCurve, uint256 minTokensOut)
        internal
        returns (uint256 tokensBurned)
    {
        if (bondingCurve == address(0)) revert ZeroAddress();
        if (usdcAmount == 0) return 0;

        IERC20 usdcToken = IERC20(usdc);
        usdcToken.forceApprove(bondingCurve, usdcAmount);
        tokensBurned = IBondingCurveWithClaim(bondingCurve).buyTokens(usdcAmount, minTokensOut);
        usdcToken.forceApprove(bondingCurve, 0);

        ITokenBurn(coin).burn(address(this), tokensBurned);
        totalBurned += tokensBurned;
    }
}
