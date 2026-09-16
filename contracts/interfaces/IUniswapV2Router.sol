// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal Uniswap V2 router interface for liquidity operations.
interface IUniswapV2Router02 {
    /// @notice Adds liquidity for tokenA/tokenB pair.
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB, uint256 liquidity);

    /// @notice Returns the router's factory address.
    function factory() external pure returns (address);
}

/// @notice Minimal Uniswap V2 factory interface.
interface IUniswapV2Factory {
    /// @notice Creates a trading pair.
    function createPair(address tokenA, address tokenB) external returns (address pair);
}
