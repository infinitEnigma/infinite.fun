// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {KeeperRegistry} from "../KeeperRegistry.sol";
import {LaunchpadFactory} from "../LaunchpadFactory.sol";

/// @title infinite.fun Deploy Script
/// @notice Deploys KeeperRegistry then LaunchpadFactory and wires them together.
/// @dev Run with: forge script contracts/script/Deploy.s.sol:Deploy \
///      --rpc-url <RPC> --private-key <KEY> --broadcast --legacy -vvv
contract Deploy is Script {
    // Arc Testnet USDC
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        // Use the key passed via --private-key CLI flag (no env parsing needed)
        vm.startBroadcast();

        address deployer = msg.sender;
        address keeper   = vm.envOr("KEEPER_ADDRESS",  deployer);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        // 1. Deploy KeeperRegistry
        KeeperRegistry registry = new KeeperRegistry(keeper, treasury);
        console.log("KeeperRegistry:", address(registry));

        // 2. Deploy LaunchpadFactory
        LaunchpadFactory factory = new LaunchpadFactory(keeper, treasury, address(registry), USDC);
        console.log("LaunchpadFactory:", address(factory));

        // 3. Wire factory into registry
        registry.setFactory(address(factory));
        console.log("Factory wired into registry");

        vm.stopBroadcast();

        // Print addresses for wiring into src/contracts.json
        console.log("---ADDRESSES---");
        console.log("REGISTRY=%s", address(registry));
        console.log("FACTORY=%s",  address(factory));
        console.log("USDC=%s",     USDC);
    }
}
