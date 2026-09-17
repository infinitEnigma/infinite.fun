// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title infinite.fun Platform Treasury
/// @notice Aggregates all protocol revenue across every launched coin.
///
/// @dev Revenue flows:
///   - 0.2% platform cut on every bonding curve swap (pushed by BondingCurve)
///   - 20% treasury slice from each SubWallet fee claim (pushed by SubWallet)
///   - Flat launch fee charged per coin launch (pushed by LaunchpadFactory)
///   - 25% of realized perp P&L from SubWallet.takeProfitSlice()
///
/// Owner (multisig or cold wallet) can withdraw any accumulated USDC.
/// Operator (keeper EOA) can trigger sweep of per-coin dust below a threshold.
/// Neither can call each other's functions — roles are explicitly separated.
contract PlatformTreasury {
    using SafeERC20 for IERC20;

    address public immutable usdc;

    /// @notice Protocol owner — multisig or cold wallet. Controls withdrawals.
    address public owner;

    /// @notice Pending owner for two-step ownership transfer.
    address public pendingOwner;

    /// @notice Keeper EOA — hot wallet for operational calls only.
    address public keeper;

    /// @notice Flat fee charged per coin launch, in USDC 6-decimal units. Default: 10 USDC.
    uint256 public launchFee;

    /// @notice Platform swap fee in basis points (bps). Default: 20 bps = 0.20%.
    uint256 public platformFeeBps;

    /// @notice Total USDC ever received by this treasury.
    uint256 public totalReceived;

    /// @notice Total USDC ever withdrawn by owner.
    uint256 public totalWithdrawn;

    error NotOwner();
    error NotKeeper();
    error NotPendingOwner();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();

    event Received(address indexed source, uint256 amount, string reason);
    event Withdrawn(address indexed to, uint256 amount);
    event LaunchFeeUpdated(uint256 oldFee, uint256 newFee);
    event PlatformFeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event OwnershipTransferInitiated(address indexed pendingOwner);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);

    constructor(address _usdc, address _owner, address _keeper) {
        if (_usdc == address(0) || _owner == address(0) || _keeper == address(0)) revert ZeroAddress();
        usdc = _usdc;
        owner = _owner;
        keeper = _keeper;
        launchFee = 10e6;     // 10 USDC default
        platformFeeBps = 20;  // 0.20% default
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyKeeper() {
        if (msg.sender != keeper) revert NotKeeper();
        _;
    }

    // -------------------------------------------------------------------------
    // Revenue receipt — called by BondingCurve, SubWallet, LaunchpadFactory
    // -------------------------------------------------------------------------

    /// @notice Receive USDC revenue. Caller must have already transferred the USDC.
    /// @dev Pull-based: caller approves + this contract pulls, OR caller already
    ///      transferred and calls this as a bookkeeping notification.
    ///      For simplicity we use the push model: callers safeTransfer then call recordReceipt.
    /// @param amount Amount of USDC received.
    /// @param reason Human-readable label ("launch_fee", "platform_swap", "treasury_split", "profit_take").
    function recordReceipt(uint256 amount, string calldata reason) external {
        if (amount == 0) revert ZeroAmount();
        totalReceived += amount;
        emit Received(msg.sender, amount, reason);
    }

    // -------------------------------------------------------------------------
    // Owner — withdrawal and config
    // -------------------------------------------------------------------------

    /// @notice Withdraw accumulated USDC to any address.
    /// @param to Recipient address.
    /// @param amount USDC amount (6 decimals).
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        uint256 bal = IERC20(usdc).balanceOf(address(this));
        if (amount > bal) revert InsufficientBalance();
        totalWithdrawn += amount;
        IERC20(usdc).safeTransfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Withdraw entire USDC balance.
    /// @param to Recipient address.
    function withdrawAll(address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        uint256 bal = IERC20(usdc).balanceOf(address(this));
        if (bal == 0) revert ZeroAmount();
        totalWithdrawn += bal;
        IERC20(usdc).safeTransfer(to, bal);
        emit Withdrawn(to, bal);
    }

    /// @notice Initiates two-step ownership transfer.
    /// @param newOwner Candidate owner who must call acceptOwnership().
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(newOwner);
    }

    /// @notice Completes ownership transfer. Must be called by pendingOwner.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /// @notice Updates the flat launch fee. Owner only.
    /// @param newFee New fee in USDC 6-decimal units.
    function setLaunchFee(uint256 newFee) external onlyOwner {
        emit LaunchFeeUpdated(launchFee, newFee);
        launchFee = newFee;
    }

    /// @notice Updates platform swap fee in basis points. Owner only. Max 100 bps (1%).
    /// @param newBps New fee in basis points.
    function setPlatformFeeBps(uint256 newBps) external onlyOwner {
        require(newBps <= 100, "PlatformTreasury: fee too high");
        emit PlatformFeeBpsUpdated(platformFeeBps, newBps);
        platformFeeBps = newBps;
    }

    // -------------------------------------------------------------------------
    // Keeper — operational role only
    // -------------------------------------------------------------------------

    /// @notice Rotates the keeper EOA. Keeper only.
    /// @param newKeeper Replacement keeper address.
    function setKeeper(address newKeeper) external onlyKeeper {
        if (newKeeper == address(0)) revert ZeroAddress();
        emit KeeperUpdated(keeper, newKeeper);
        keeper = newKeeper;
    }

    // -------------------------------------------------------------------------
    // View helpers
    // -------------------------------------------------------------------------

    /// @notice Current USDC balance held in this contract.
    function balance() external view returns (uint256) {
        return IERC20(usdc).balanceOf(address(this));
    }
}
