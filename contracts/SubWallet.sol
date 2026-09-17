// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IHyperliquidBridge} from "./interfaces/IHyperliquidBridge.sol";

interface ITokenBurn {
    function burn(address from, uint256 amount) external;
}

interface IBondingCurveWithClaim {
    function claimFees() external returns (uint256 fees);
    function buyTokens(uint256 usdcIn, uint256 minTokensOut) external returns (uint256 tokensOut);
    function getPrice() external view returns (uint256);
}

interface IKeeperRegistry {
    function getCoinCurve(address coin) external view returns (address curve);
}

interface IPlatformTreasurySubWallet {
    function recordReceipt(uint256 amount, string calldata reason) external;
}

/// @title infinite.fun SubWallet
/// @notice Per-coin USDC treasury and keeper-executed strategy wallet.
///
/// @dev Fee split on each claimAndSplit() call (net fees from BondingCurve):
///   50% → perp margin buffer (stays in SubWallet until openPosition/addMargin)
///   15% → creator fee recipient
///   20% → PlatformTreasury (pushed directly, not held here)
///   15% → feeDest (buyback+burn when burnMode=true, or held for LP otherwise)
///
/// PlatformTreasury is a separate immutable address — not the same as the keeper.
/// This enforces clean role separation: keeper = hot operational wallet,
/// treasury = cold aggregator of all protocol revenue.
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

    /// @notice PlatformTreasury — receives 20% of every fee claim and 25% of profit takes.
    address public immutable platformTreasury;

    /// @notice Allowlisted address for emergency withdrawals (defaults to platformTreasury).
    address public emergencyRecipient;

    error NotKeeper();
    error ZeroAddress();
    error PositionNotInitialized();
    error PositionAlreadyOpen();

    event FeeClaimed(
        uint256 feeAmount,
        uint256 perpSlice,
        uint256 creatorSlice,
        uint256 platformSlice,
        uint256 destSlice
    );
    event ProfitTaken(uint256 realizedPnl, uint256 burned, uint256 platformSlice);
    event BuybackBurned(uint256 usdcSpent, uint256 tokensBurned);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);

    /// @notice Initializes the SubWallet.
    /// @param _coin Coin token address.
    /// @param _keeper Keeper authority (hot wallet).
    /// @param _factory LaunchpadFactory address.
    /// @param _registry KeeperRegistry address.
    /// @param _usdc USDC token address.
    /// @param _platformTreasury PlatformTreasury contract (receives 20% slice).
    constructor(
        address _coin,
        address _keeper,
        address _factory,
        address _registry,
        address _usdc,
        address _platformTreasury
    ) {
        if (
            _coin == address(0) || _keeper == address(0) || _factory == address(0)
                || _registry == address(0) || _usdc == address(0) || _platformTreasury == address(0)
        ) revert ZeroAddress();

        coin             = _coin;
        keeper           = _keeper;
        factory          = _factory;
        registry         = _registry;
        usdc             = _usdc;
        platformTreasury = _platformTreasury;
        emergencyRecipient = _platformTreasury; // default emergency drain goes to treasury
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /// @notice Sets the Hyperliquid position ID after opening.
    /// @param _positionId Hyperliquid position identifier.
    function setPositionId(bytes32 _positionId) external onlyKeeper {
        positionId = _positionId;
    }

    /// @notice Rotates the keeper EOA.
    /// @param newKeeper Replacement keeper address.
    function setKeeper(address newKeeper) external onlyKeeper {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Updates emergency recipient. Must be a trusted address (e.g. new treasury).
    /// @param newRecipient New emergency recipient address.
    function setEmergencyRecipient(address newRecipient) external onlyKeeper {
        if (newRecipient == address(0)) revert ZeroAddress();
        emergencyRecipient = newRecipient;
    }

    // -------------------------------------------------------------------------
    // Keeper loop
    // -------------------------------------------------------------------------

    /// @notice Claims net fees from the BondingCurve and splits 50/15/20/15.
    /// @dev BondingCurve.claimFees() resets accumulatedFees and pushes net USDC here.
    ///      The 20% platform slice is pushed directly to PlatformTreasury.
    /// @param creatorFeeRecipient Recipient for the 15% creator slice.
    /// @param feeDest Destination for the 15% dest slice.
    /// @param burnMode When true, dest slice is used for immediate buyback+burn.
    /// @param minTokensOut Slippage guard for buyback (pass 0 to skip buyback this tick).
    function claimAndSplit(
        address creatorFeeRecipient,
        address feeDest,
        bool burnMode,
        uint256 minTokensOut
    ) external onlyKeeper {
        if (creatorFeeRecipient == address(0) || feeDest == address(0)) revert ZeroAddress();

        address curve = IKeeperRegistry(registry).getCoinCurve(coin);
        uint256 feeAmount = IBondingCurveWithClaim(curve).claimFees();
        if (feeAmount == 0) return;

        uint256 perpSlice     = (feeAmount * 50) / 100;
        uint256 creatorSlice  = (feeAmount * 15) / 100;
        uint256 platformSlice = (feeAmount * 20) / 100;
        // Remainder captures integer-division dust into dest slice.
        uint256 destSlice = feeAmount - perpSlice - creatorSlice - platformSlice;

        IERC20 usdcToken = IERC20(usdc);

        // Creator slice.
        usdcToken.safeTransfer(creatorFeeRecipient, creatorSlice);

        // Platform slice → PlatformTreasury directly.
        if (platformSlice > 0) {
            usdcToken.safeTransfer(platformTreasury, platformSlice);
            IPlatformTreasurySubWallet(platformTreasury).recordReceipt(platformSlice, "treasury_split");
        }

        // Dest slice: buyback+burn or hold.
        if (burnMode && destSlice > 0) {
            _buybackAndBurn(destSlice, curve, minTokensOut);
        }
        // perpSlice stays in SubWallet as collateral buffer for openPosition / addMargin.

        emit FeeClaimed(feeAmount, perpSlice, creatorSlice, platformSlice, destSlice);
    }

    /// @notice Opens a leveraged position via Hyperliquid bridge. Enforced singleton.
    /// @param usdcAmount USDC collateral amount.
    /// @param leverage Desired leverage (1–25).
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

    /// @notice Takes profit on 25% of position. Routes 75% to burn, 25% to PlatformTreasury.
    /// @param hyperliquidBridge Bridge contract.
    /// @param minTokensOut Slippage guard for buyback.
    function takeProfitSlice(address hyperliquidBridge, uint256 minTokensOut)
        external
        onlyKeeper
    {
        if (hyperliquidBridge == address(0)) revert ZeroAddress();
        if (positionId == bytes32(0)) revert PositionNotInitialized();

        uint256 realizedPnl = IHyperliquidBridge(hyperliquidBridge).closePartial(positionId, 0.25e18);
        totalPnlRealized += realizedPnl;

        uint256 burnUsdc      = (realizedPnl * 75) / 100;
        uint256 platformSlice = realizedPnl - burnUsdc;

        address curve = IKeeperRegistry(registry).getCoinCurve(coin);
        uint256 burned = 0;
        if (burnUsdc > 0) {
            burned = _buybackAndBurn(burnUsdc, curve, minTokensOut);
        }

        if (platformSlice > 0) {
            IERC20(usdc).safeTransfer(platformTreasury, platformSlice);
            IPlatformTreasurySubWallet(platformTreasury).recordReceipt(platformSlice, "profit_take");
        }

        emit ProfitTaken(realizedPnl, burned, platformSlice);
    }

    /// @notice Executes a standalone buyback+burn (keeper can trigger outside profit-take).
    /// @param usdcAmount USDC to spend.
    /// @param bondingCurve Curve address.
    /// @param minTokensOut Slippage guard.
    function executeBuyback(uint256 usdcAmount, address bondingCurve, uint256 minTokensOut)
        external
        onlyKeeper
    {
        uint256 burned = _buybackAndBurn(usdcAmount, bondingCurve, minTokensOut);
        emit BuybackBurned(usdcAmount, burned);
    }

    /// @notice Emergency USDC drain to allowlisted emergencyRecipient. Keeper only.
    /// @param amount USDC amount.
    function withdrawTo(uint256 amount) external onlyKeeper {
        IERC20(usdc).safeTransfer(emergencyRecipient, amount);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

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
