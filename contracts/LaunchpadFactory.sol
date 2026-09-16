// SPDX-License-Identifier: MIT
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

/// @title infinite.fun Launchpad Factory
/// @notice Deploys Token, SubWallet, and BondingCurve for each launch.
contract LaunchpadFactory {
    using SafeERC20 for IERC20;

    uint256 public constant DEFAULT_GRADUATION_THRESHOLD = 420e6; // 420 USDC testnet-friendly

    address public keeper;
    address public treasury;
    address public registry;
    address public usdc;

    mapping(address => address) public curveToToken;

    error NotKeeper();
    error NotCurve();
    error ZeroAddress();

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
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Initializes factory roles and external dependencies.
    constructor(address _keeper, address _treasury, address _registry, address _usdc) {
        if (_keeper == address(0) || _treasury == address(0) || _registry == address(0) || _usdc == address(0)) {
            revert ZeroAddress();
        }
        keeper = _keeper;
        treasury = _treasury;
        registry = _registry;
        usdc = _usdc;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    /// @notice Launches a new coin stack (Token + SubWallet + BondingCurve).
    /// @dev Deploys contracts, wires them together, and registers in KeeperRegistry.
    /// @param name ERC-20 token name.
    /// @param ticker ERC-20 ticker symbol.
    /// @param market Market label for keeper strategy.
    /// @param leverage Configured leverage for strategy.
    /// @param feeDest Destination fee address.
    /// @param burnMode Burn mode flag.
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

        // Deploy Token with placeholder wiring; factory holds initial supply.
        Token tokenContract = new Token(name, ticker, address(0), address(0));
        token = address(tokenContract);

        // Deploy SubWallet before curve — SubWallet address needed for curve init.
        SubWallet subWalletContract = new SubWallet(token, keeper, address(this), registry, usdc);
        subWallet = address(subWalletContract);

        // Deploy BondingCurve.
        BondingCurve curveContract =
            new BondingCurve(token, usdc, subWallet, address(this), DEFAULT_GRADUATION_THRESHOLD);
        curve = address(curveContract);

        // Wire Token to its SubWallet and BondingCurve (each settable exactly once).
        tokenContract.setSubWallet(subWallet);
        tokenContract.setBondingCurve(curve);

        // Transfer entire supply to curve (factory holds it until now).
        IERC20 tokenERC20 = IERC20(token);
        tokenERC20.safeTransfer(curve, tokenContract.totalSupply());

        curveToToken[curve] = token;

        // Register in KeeperRegistry — pass market/leverage as separate vars to avoid stack-too-deep.
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

    /// @notice Callback invoked by a BondingCurve when graduation threshold is met.
    /// @param curve The graduating curve address.
    function onGraduated(address curve) external {
        address token = curveToToken[curve];
        if (token == address(0)) revert NotCurve();
        if (msg.sender != curve) revert NotCurve();

        IKeeperRegistryFactory(registry).markGraduated(token);
        emit CoinGraduated(token, curve);
    }

    /// @notice Updates keeper address. Emits KeeperUpdated.
    /// @param newKeeper New keeper authority.
    function setKeeper(address newKeeper) external onlyKeeper {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    /// @notice Updates treasury address. Emits TreasuryUpdated.
    /// @param newTreasury New treasury recipient.
    function setTreasury(address newTreasury) external onlyKeeper {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }
}
