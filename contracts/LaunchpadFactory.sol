// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {Token} from "./Token.sol";
import {BondingCurve} from "./BondingCurve.sol";
import {SubWallet} from "./SubWallet.sol";

interface IKeeperRegistryFactory {
    function registerCoin(
        address coin,
        address subWallet,
        address curve,
        address creator,
        string calldata market,
        uint64 leverage,
        address feeDest,
        bool burnMode
    ) external;

    function markGraduated(address coin) external;
}

interface IPlatformTreasuryFactory {
    function launchFee() external view returns (uint256);
    function recordReceipt(uint256 amount, string calldata reason) external;
}

/// @title infinite.fun Launchpad Factory
/// @notice Deploys Token, SubWallet, and BondingCurve for each launch.
///
/// @dev Platform revenue collected here:
///   - Flat launch fee (launchFee from PlatformTreasury, paid by coin creator in USDC).
///
/// The 0.20% platform swap cut is collected directly by BondingCurve on each swap.
/// The 20% treasury split from fees is pushed by SubWallet.claimAndSplit() to PlatformTreasury.
contract LaunchpadFactory {
    using SafeERC20 for IERC20;

    uint256 public constant DEFAULT_GRADUATION_THRESHOLD = 420e6; // 420 USDC testnet

    /// @notice Keeper EOA — hot wallet for operational txs. Does NOT control treasury.
    address public keeper;

    /// @notice PlatformTreasury contract — aggregates all protocol revenue.
    address public platformTreasury;

    address public registry;
    address public usdc;

    mapping(address => address) public curveToToken;

    error NotKeeper();
    error NotCurve();
    error ZeroAddress();
    error InsufficientLaunchFee();

    event CoinLaunched(
        address indexed token,
        address indexed curve,
        address indexed subWallet,
        address creator,
        string name,
        string ticker
    );
    event CoinGraduated(address indexed token, address indexed curve);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event PlatformTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Initializes factory with separated keeper and treasury roles.
    /// @param _keeper Keeper EOA (hot wallet, operational only).
    /// @param _platformTreasury PlatformTreasury contract (cold, owner-controlled).
    /// @param _registry KeeperRegistry contract.
    /// @param _usdc USDC token address.
    constructor(address _keeper, address _platformTreasury, address _registry, address _usdc) {
        if (_keeper == address(0) || _platformTreasury == address(0) || _registry == address(0) || _usdc == address(0)) {
            revert ZeroAddress();
        }
        keeper           = _keeper;
        platformTreasury = _platformTreasury;
        registry         = _registry;
        usdc             = _usdc;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    // -------------------------------------------------------------------------
    // Coin launch
    // -------------------------------------------------------------------------

    /// @notice Launches a new coin stack (Token + SubWallet + BondingCurve).
    /// @dev Caller must approve launchFee USDC to this contract before calling.
    ///      Launch fee is read from PlatformTreasury and forwarded there atomically.
    /// @param name ERC-20 token name.
    /// @param ticker ERC-20 ticker symbol.
    /// @param market Market label for keeper strategy (e.g. "BTC", "ETH").
    /// @param leverage Configured leverage for the perp strategy (1–25).
    /// @param feeDest Destination for the buyback/LP 15% fee slice.
    /// @param burnMode When true, the 15% dest slice is used for buyback+burn.
    /// @return token Address of deployed Token.
    /// @return curve Address of deployed BondingCurve.
    /// @return subWallet Address of deployed SubWallet.
    function launchCoin(
        string calldata name,
        string calldata ticker,
        string calldata market,
        uint64 leverage,
        address feeDest,
        bool burnMode
    ) external returns (address token, address curve, address subWallet) {
        if (feeDest == address(0)) revert ZeroAddress();

        // Collect flat launch fee from creator.
        uint256 fee = IPlatformTreasuryFactory(platformTreasury).launchFee();
        if (fee > 0) {
            IERC20(usdc).safeTransferFrom(msg.sender, platformTreasury, fee);
            IPlatformTreasuryFactory(platformTreasury).recordReceipt(fee, "launch_fee");
        }

        // Deploy Token with placeholder wiring; factory holds initial supply.
        Token tokenContract = new Token(name, ticker, address(0), address(0));
        token = address(tokenContract);

        // Deploy SubWallet before curve (SubWallet address needed for BondingCurve init).
        SubWallet subWalletContract = new SubWallet(token, keeper, address(this), registry, usdc, platformTreasury);
        subWallet = address(subWalletContract);

        // Deploy BondingCurve — platformTreasury receives 0.20% cut on every swap.
        BondingCurve curveContract = new BondingCurve(
            token, usdc, subWallet, address(this), platformTreasury, DEFAULT_GRADUATION_THRESHOLD
        );
        curve = address(curveContract);

        // Wire Token to its SubWallet and BondingCurve (each settable exactly once).
        tokenContract.setSubWallet(subWallet);
        tokenContract.setBondingCurve(curve);

        // Transfer entire supply from factory to curve.
        IERC20(token).safeTransfer(curve, tokenContract.totalSupply());

        curveToToken[curve] = token;

        // Register coin in KeeperRegistry.
        _registerCoin(token, subWallet, curve, market, leverage, feeDest, burnMode);

        emit CoinLaunched(token, curve, subWallet, msg.sender, name, ticker);
    }

    /// @dev Extracted to avoid stack-too-deep in launchCoin.
    function _registerCoin(
        address token,
        address subWallet,
        address curve,
        string calldata market,
        uint64 leverage,
        address feeDest,
        bool burnMode
    ) internal {
        IKeeperRegistryFactory(registry).registerCoin(
            token, subWallet, curve, msg.sender, market, leverage, feeDest, burnMode
        );
    }

    // -------------------------------------------------------------------------
    // Graduation callback
    // -------------------------------------------------------------------------

    /// @notice Callback invoked by a BondingCurve when graduation threshold is crossed.
    /// @param curve The graduating curve address.
    function onGraduated(address curve) external {
        address token = curveToToken[curve];
        if (token == address(0)) revert NotCurve();
        if (msg.sender != curve) revert NotCurve();

        IKeeperRegistryFactory(registry).markGraduated(token);
        emit CoinGraduated(token, curve);
    }

    // -------------------------------------------------------------------------
    // Admin — keeper-only role rotation
    // -------------------------------------------------------------------------

    /// @notice Rotates keeper EOA. Only the current keeper can call.
    /// @param newKeeper New keeper address.
    function setKeeper(address newKeeper) external onlyKeeper {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Updates PlatformTreasury address. Only the current keeper can call.
    /// @param newTreasury New PlatformTreasury contract address.
    function setPlatformTreasury(address newTreasury) external onlyKeeper {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit PlatformTreasuryUpdated(platformTreasury, newTreasury);
        platformTreasury = newTreasury;
    }
}
