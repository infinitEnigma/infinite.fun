// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Hyperliquid bridge interface.
/// @dev Arbitrum deployment reference (comment only): 0x2Df1c51E09aECF9d4F6e7E5a4D7E1a2b9E7c0d3
interface IHyperliquidBridge {
    /// @notice Deposits USDC collateral and opens/increases a leveraged position.
    /// @param token The collateral token address (USDC).
    /// @param usdcAmount The USDC amount (6 decimals).
    /// @param leverage The leverage multiplier in protocol-defined units.
    /// @param isLong True for long position, false for short.
    function depositAndBuy(address token, uint256 usdcAmount, uint64 leverage, bool isLong) external;

    /// @notice Adds margin to an existing position.
    /// @param positionId The position identifier.
    /// @param usdcAmount The additional USDC amount (6 decimals).
    function addMargin(bytes32 positionId, uint256 usdcAmount) external;

    /// @notice Closes a fraction of an existing position.
    /// @param positionId The position identifier.
    /// @param fraction Fraction to close in 1e18 precision (e.g. 0.25e18 = 25%).
    /// @return realizedPnl The realized PnL amount returned by the bridge.
    function closePartial(bytes32 positionId, uint256 fraction) external returns (uint256 realizedPnl);

    /// @notice Returns on-chain position state.
    /// @param positionId The position identifier.
    /// @return collateral Current collateral.
    /// @return size Current position size.
    /// @return entryPrice Entry price.
    /// @return markPrice Current mark price.
    /// @return unrealizedPnl Current unrealized PnL.
    /// @return isLong True if position is long.
    function getPosition(bytes32 positionId)
        external
        view
        returns (
            uint256 collateral,
            uint256 size,
            uint256 entryPrice,
            uint256 markPrice,
            int256 unrealizedPnl,
            bool isLong
        );
}
