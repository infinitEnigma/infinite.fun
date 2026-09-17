// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {InfiniteToken} from "../InfiniteToken.sol";
import {TokenVesting} from "../TokenVesting.sol";

/// @notice Deploys InfiniteToken + TokenVesting to Arc Testnet.
///         The deployer becomes the initial owner of TokenVesting and
///         receives the teamVesting bucket — transfer to the vesting
///         contract address (printed below) and create schedules via
///         TokenVesting.createSchedule().
contract DeployToken is Script {
    function run() external {
        vm.startBroadcast();

        address deployer = msg.sender;

        // 1. Deploy vesting contract first (needs token address later — use two-step)
        //    We pass a temporary placeholder; token address wired after.
        //    Actually: deploy token first with deployer as all 5 buckets,
        //    then deploy vesting, then owner transfers teamVesting allocation to vesting.

        // Step 1: deploy TokenVesting (token address set after)
        // We need token address first, so deploy token with deployer holding teamVesting bucket.
        // Then deploy vesting. Then transfer team allocation to vesting contract.

        // Deploy token — deployer holds all 5 buckets initially.
        // In production, replace these with real multisig/cold wallet addresses.
        InfiniteToken token = new InfiniteToken(
            deployer, // communityTreasury  (40%) — replace with governance/multisig
            deployer, // protocolTreasury   (25%) — replace with PlatformTreasury address
            deployer, // teamVesting        (20%) — will transfer to vesting contract below
            deployer, // ecosystemGrants    (10%) — replace with grants multisig
            deployer  // liquidityBootstrap ( 5%) — replace with liquidity manager
        );
        console.log("InfiniteToken:", address(token));
        console.log("Total supply:", token.totalSupply());

        // Deploy vesting
        TokenVesting vesting = new TokenVesting(address(token), deployer);
        console.log("TokenVesting:", address(vesting));

        // Transfer team allocation (20%) to vesting contract
        // Keeper/owner can then call createSchedule() for team members
        uint256 teamAlloc = token.TEAM_ALLOCATION();
        token.transfer(address(vesting), teamAlloc);
        console.log("Team allocation transferred to vesting:", teamAlloc);

        vm.stopBroadcast();

        console.log("---");
        console.log("NEXT STEPS:");
        console.log("1. Transfer communityTreasury tokens to governance contract when ready");
        console.log("2. Transfer protocolTreasury tokens to PlatformTreasury contract");
        console.log("3. Call vesting.createSchedule() for each team member (4yr vest, 1yr cliff)");
        console.log("4. Update src/contracts.json with InfiniteToken and TokenVesting addresses");
    }
}
