// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {KeeperRegistry} from "../KeeperRegistry.sol";
import {LaunchpadFactory} from "../LaunchpadFactory.sol";
import {PlatformTreasury} from "../PlatformTreasury.sol";

/// @title infinite.fun Deploy Script
/// @notice Deploys PlatformTreasury → KeeperRegistry → LaunchpadFactory and wires them.
///
/// @dev Run with:
///   forge script contracts/script/Deploy.s.sol:Deploy \
///     --rpc-url arc_testnet --private-key <KEY> --broadcast --legacy -vvv
///
/// Required env vars (optional — falls back to deployer address):
///   KEEPER_ADDRESS   — hot wallet EOA for keeper operations
///   TREASURY_OWNER   — cold wallet / multisig that owns PlatformTreasury withdrawals
///
/// These roles MUST be different addresses on mainnet.
contract Deploy is Script {
    // Arc Testnet USDC
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        vm.startBroadcast();

        address deployer       = msg.sender;
        // Keeper: hot wallet for operational txs. Use a separate funded EOA on mainnet.
        address keeper         = vm.envOr("KEEPER_ADDRESS",  deployer);
        // Treasury owner: cold wallet / multisig. Separate from keeper on mainnet.
        address treasuryOwner  = vm.envOr("TREASURY_OWNER", deployer);

        // 1. Deploy PlatformTreasury
        //    owner = treasuryOwner (controls withdrawals, fee params)
        //    keeper = keeper       (can rotate keeper address only)
        PlatformTreasury treasury = new PlatformTreasury(USDC, treasuryOwner, keeper);
        console.log("PlatformTreasury:", address(treasury));

        // 2. Deploy KeeperRegistry
        KeeperRegistry registry = new KeeperRegistry(keeper, address(treasury));
        console.log("KeeperRegistry:", address(registry));

        // 3. Deploy LaunchpadFactory
        //    keeper          = keeper          (hot, operational)
        //    platformTreasury = treasury       (cold aggregator)
        LaunchpadFactory factory = new LaunchpadFactory(
            keeper,
            address(treasury),
            address(registry),
            USDC
        );
        console.log("LaunchpadFactory:", address(factory));

        // 4. Wire factory into registry so it can call registerCoin().
        registry.setFactory(address(factory));
        console.log("Factory wired into registry");

        vm.stopBroadcast();

        // Print for src/contracts.json wiring
        console.log("---ADDRESSES---");
        console.log("TREASURY=%s",  address(treasury));
        console.log("REGISTRY=%s",  address(registry));
        console.log("FACTORY=%s",   address(factory));
        console.log("USDC=%s",      USDC);
    }
}
