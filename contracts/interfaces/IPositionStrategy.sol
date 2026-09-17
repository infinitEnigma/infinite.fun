// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPositionStrategy
 * @notice Forward-looking strategy interface for the infinite.fun Strategy Layer.
 * @dev Today, keeper execution uses hardcoded decision logic in the protocol flow.
 *      Future versions are expected to accept an `IPositionStrategy` address so that
 *      strategy decisions are modular and replaceable without rewriting keeper wiring.
 *
 *      Governance intent:
 *      - Community governance is expected to approve and curate which strategies are
 *        eligible for treasury or product allocation.
 *      - Approval can cover multiple strategy styles, including:
 *          1) simple deterministic rule-based logic,
 *          2) off-chain ML-trained agents that publish signed recommendations,
 *          3) fully on-chain algorithmic implementations.
 *
 *      Advisory boundary:
 *      - `evaluate` is a view-only advisory function and does not execute trades.
 *      - Position execution remains the responsibility of SubWallet/keeper/coordinator.
 */
interface IPositionStrategy {
    /// @notice Encoded actions a strategy may recommend to the keeper/coordinator.
    enum StrategyAction {
        HOLD, // 0: Do nothing this tick
        ADD_MARGIN, // 1: param = USDC amount to add as margin
        TAKE_PROFIT, // 2: param = fraction of position to close (1e18 = 100%)
        OPEN_POSITION, // 3: param = USDC amount to use as initial collateral
        CLAIM_AND_SPLIT, // 4: param = unused, claim accumulated fees and split
        CLOSE_POSITION // 5: param = unused, close entire position (emergency)
    }

    /// @notice Returns a human-readable name for this strategy.
    function name() external view returns (string memory);

    /// @notice Returns a version string for this strategy implementation.
    function version() external view returns (string memory);

    /// @notice Returns the risk tier: 0=conservative, 1=balanced, 2=aggressive.
    function riskTier() external view returns (uint8);

    /// @notice Called by the keeper/coordinator to evaluate the current position
    ///         and return an action to execute.
    /// @param collateral Current USDC collateral in SubWallet (6 decimals).
    /// @param positionSize Current position size in USD (6 decimals).
    /// @param entryPrice Position entry price (8 decimals).
    /// @param markPrice Current mark price from oracle (8 decimals).
    /// @param unrealizedPnl Unrealized P&L, signed (6 decimals, negative = loss).
    /// @param accumulatedFees Fees accumulated in SubWallet since last claim (6 decimals).
    /// @return action Encoded action: see StrategyAction enum.
    /// @return param Action-specific parameter (amount, fraction, leverage).
    function evaluate(
        uint256 collateral,
        uint256 positionSize,
        uint256 entryPrice,
        uint256 markPrice,
        int256 unrealizedPnl,
        uint256 accumulatedFees
    ) external view returns (uint8 action, uint256 param);

    /// @notice Returns whether this strategy is approved for use on-chain.
    /// @dev The strategy registry will call this to verify before activation.
    function isApproved() external view returns (bool);
}
