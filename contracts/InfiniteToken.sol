// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {Nonces} from "@openzeppelin/contracts/utils/Nonces.sol";

/// @title Infinite Governance Token
/// @notice Fixed-supply governance token for the infinite.fun platform.
contract InfiniteToken is ERC20, ERC20Permit, ERC20Votes {
    /// @notice Total fixed supply minted at deployment.
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18;

    /// @notice Community treasury allocation (40%).
    uint256 public constant COMMUNITY_ALLOCATION = 400_000_000e18;

    /// @notice Protocol treasury allocation (25%).
    uint256 public constant PROTOCOL_ALLOCATION = 250_000_000e18;

    /// @notice Team vesting allocation (20%).
    uint256 public constant TEAM_ALLOCATION = 200_000_000e18;

    /// @notice Ecosystem grants allocation (10%).
    uint256 public constant ECOSYSTEM_ALLOCATION = 100_000_000e18;

    /// @notice Liquidity bootstrap allocation (5%).
    uint256 public constant LIQUIDITY_ALLOCATION = 50_000_000e18;

    error ZeroAddress();
    error InvalidAllocation();

    /// @notice Deploys the INF token and mints the full fixed supply into allocation buckets.
    /// @param communityTreasury Address receiving the community treasury allocation.
    /// @param protocolTreasury Address receiving the protocol treasury allocation.
    /// @param teamVesting Address receiving the team vesting allocation.
    /// @param ecosystemGrants Address receiving the ecosystem grants allocation.
    /// @param liquidityBootstrap Address receiving the liquidity bootstrap allocation.
    constructor(
        address communityTreasury,
        address protocolTreasury,
        address teamVesting,
        address ecosystemGrants,
        address liquidityBootstrap
    ) ERC20("Infinite", "INF") ERC20Permit("Infinite") {
        if (
            communityTreasury == address(0) || protocolTreasury == address(0) || teamVesting == address(0)
                || ecosystemGrants == address(0) || liquidityBootstrap == address(0)
        ) {
            revert ZeroAddress();
        }

        if (
            COMMUNITY_ALLOCATION + PROTOCOL_ALLOCATION + TEAM_ALLOCATION + ECOSYSTEM_ALLOCATION
                + LIQUIDITY_ALLOCATION != TOTAL_SUPPLY
        ) {
            revert InvalidAllocation();
        }

        _mint(communityTreasury, COMMUNITY_ALLOCATION);
        _mint(protocolTreasury, PROTOCOL_ALLOCATION);
        _mint(teamVesting, TEAM_ALLOCATION);
        _mint(ecosystemGrants, ECOSYSTEM_ALLOCATION);
        _mint(liquidityBootstrap, LIQUIDITY_ALLOCATION);
    }

    /// @dev Required override for OpenZeppelin ERC20Votes bookkeeping.
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    /// @notice Returns the current nonce for permit signatures.
    /// @param owner The address whose nonce is queried.
    /// @return The current nonce for `owner`.
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }
}
