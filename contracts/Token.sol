// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title infinite.fun Launch Token
/// @notice Fixed-supply ERC-20 used by the infinite.fun launchpad.
contract Token is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    address public bondingCurve;
    address public immutable factory;
    address public subWallet;

    error NotFactory();
    error NotSubWallet();
    error ZeroAddress();
    error AlreadySet();

    /// @notice Creates the token and mints the entire supply.
    /// @dev For factory bootstrapping, bondingCurve can be zero and supply is minted to factory,
    /// then transferred to the curve during launch initialization.
    /// @param name The token name.
    /// @param symbol The token symbol.
    /// @param _bondingCurve Bonding curve address, or zero during factory bootstrap.
    /// @param _subWallet SubWallet address, or zero during factory bootstrap.
    constructor(string memory name, string memory symbol, address _bondingCurve, address _subWallet) ERC20(name, symbol) {
        factory = msg.sender;
        bondingCurve = _bondingCurve;
        subWallet = _subWallet;

        address initialReceiver = _bondingCurve == address(0) ? msg.sender : _bondingCurve;
        _mint(initialReceiver, TOTAL_SUPPLY);
    }

    modifier onlyFactory() {
        if (msg.sender != factory) revert NotFactory();
        _;
    }

    modifier onlySubWallet() {
        if (msg.sender != subWallet) revert NotSubWallet();
        _;
    }

    /// @notice Sets the SubWallet address once.
    /// @dev Called by LaunchpadFactory immediately after SubWallet deployment.
    /// @param _subWallet The SubWallet for this token.
    function setSubWallet(address _subWallet) external onlyFactory {
        if (_subWallet == address(0)) revert ZeroAddress();
        if (subWallet != address(0)) revert AlreadySet();
        subWallet = _subWallet;
    }

    /// @notice Sets the BondingCurve address once.
    /// @dev Called by LaunchpadFactory immediately after BondingCurve deployment.
    /// @param _bondingCurve The BondingCurve for this token.
    function setBondingCurve(address _bondingCurve) external onlyFactory {
        if (_bondingCurve == address(0)) revert ZeroAddress();
        if (bondingCurve != address(0)) revert AlreadySet();
        bondingCurve = _bondingCurve;
    }

    /// @notice Burns tokens from a target address.
    /// @dev Callable only by the registered SubWallet.
    /// @param from The address whose balance is burned.
    /// @param amount The amount of tokens to burn.
    function burn(address from, uint256 amount) external onlySubWallet {
        _burn(from, amount);
    }
}
