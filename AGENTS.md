# infinite.fun

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

A token launchpad on Arc Testnet where every launched ERC-20 is backed by a live leveraged perpetual position.
A bonding curve funds the position from fees; a keeper loop claims fees, splits them 50/15/20/15,
tops up margin, and burns supply on profit-takes. Inspired by the Perps Hood paper (https://perpshood.fun/paper).

## Deployed Contracts (Arc Testnet — Chain ID 5042002)

### v3 — Current (INF governance token + TokenVesting deployed)

| Contract | Address |
|---|---|
| InfiniteToken (INF) | `0x199c7111bdfeB8aA8a3ABf7AB69D5554aD8c7A37` |
| TokenVesting       | `0xBea77a9787B2A39a973B12f54387ebe625A68968` |

- 1B fixed supply ERC20Votes. Allocation: 40% community, 25% treasury, 20% team (vesting), 10% ecosystem, 5% liquidity.
- TeamVesting schedule: 4yr linear, 1yr cliff. Call `vesting.createSchedule()` per team member.
- IPositionStrategy interface stub at `contracts/interfaces/IPositionStrategy.sol`.
- Deployed by: `0xf7B35a7cDCb6f39ad42ADf7111Ce74B890F5e1B4`
- Deployed at: 2026-09-17

### v2 — (PlatformTreasury added, keeper/treasury roles separated)

| Contract | Address |
|---|---|
| PlatformTreasury | `0x3cb9f3E17cfF1FeaB02F8a09c7d8c7755c7777Fd` |
| KeeperRegistry   | `0x51DA850AB51a15624553ABcbAF408B63223B0897` |
| LaunchpadFactory | `0x919fb3Bf0A66B48c64e8b3857C610C3C2bc0F62A` |
| USDC (Arc Testnet) | `0x3600000000000000000000000000000000000000` |

- Deployed by: `0xf7B35a7cDCb6f39ad42ADf7111Ce74B890F5e1B4`
- Deployed at: 2026-09-17
- Addresses also in `src/contracts.json`

### v1 — Superseded

| Contract | Address |
|---|---|
| KeeperRegistry | `0xfd8B9Ddb776Bd1608F1774255B7FE2caf674fa08` |
| LaunchpadFactory | `0x937a4C48E3C50875AF19825B177d6A71b5194C31` |

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
