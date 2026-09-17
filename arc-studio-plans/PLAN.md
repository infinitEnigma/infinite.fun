# Implementation Plan: infinite.fun

## Summary
A token launchpad on Arc Testnet where every launched ERC-20 is backed by a live leveraged perpetual position. A bonding curve funds the position from fees; a keeper loop claims fees, splits them 50/15/20/15, tops up margin, and burns supply on profit-takes. Hyperliquid is the perp routing destination; Uniswap V2 receives migrated liquidity at graduation.

## Architecture
- **Blockchain:** Arc Testnet (chain ID 5042002). USDC is the native gas token — one balance, no ETH needed. Sub-second finality suits the 15-second keeper tick.
- **Contracts (5 total):**
  1. `LaunchpadFactory.sol` — deploys a `BondingCurve` + `SubWallet` + `Token` per coin. Stores the fee split (50/15/20/15 in basis points). Issues the first perp open once $20 collateral has accrued.
  2. `Token.sol` — standard ERC-20, fixed 1B supply, no mint. Includes a `burn(address, uint)` that only the owning `SubWallet` may call.
  3. `BondingCurve.sol` — constant-product curve (xy=k variant). 1% flat fee on every swap. Tracks cumulative fees per coin. Emits `Graduated` when the 4.2 ETH-equivalent USDC threshold is crossed; graduation triggers LP migration to Uniswap V2.
  4. `SubWallet.sol` — one deployed per coin, derived via `CREATE2` (coin address as salt). Holds USDC collateral for the perp. Only the keeper EOA (stored in Factory) may call `claimAndSplit`, `addMargin`, `openPosition`, `takeProfitSlice`, and `burnBuyback`. Integrates Hyperliquid's on-chain API (`IHyperliquidBridge`) for margin posting and partial close.
  5. `KeeperRegistry.sol` — lightweight registry: stores authorized keeper address, coin→SubWallet mapping, and coin state (pendingFees, collateral, positionSize, openPrice). Emitted events drive the UI feed.
- **Keeper service:** Off-chain TypeScript script (`scripts/keeper.ts`) that polls every 15 seconds. Calls `claimAndSplit` on each active SubWallet, checks position P&L via Hyperliquid read API, triggers `takeProfitSlice` at +50% or `addMargin` in drawdown.
- **Frontend:** Vite + React + TypeScript + Tailwind. Arc Dark mode (trading/data archetype). Pages: `/` launch feed, `/launch` create-coin form, `/coin/:address` detail page (bonding curve chart, perp position card, fee split breakdown, keeper log).
- **Wallet:** ConnectKit + wagmi, Arc Testnet.

## Files to Create / Modify

### Contracts
1. `contracts/Token.sol` — ERC-20, 1B fixed supply, burn restricted to SubWallet.
2. `contracts/SubWallet.sol` — per-coin treasury; fee split logic; Hyperliquid bridge calls; profit-take + burn.
3. `contracts/BondingCurve.sol` — xy=k curve, 1% fee, graduation at configurable USDC threshold, Uniswap V2 migration.
4. `contracts/LaunchpadFactory.sol` — CREATE2 deploys Token + SubWallet + BondingCurve; registers in KeeperRegistry.
5. `contracts/KeeperRegistry.sol` — keeper address ACL; coin state storage; events for UI feed.
6. `contracts/interfaces/IHyperliquidBridge.sol` — minimal interface for `depositAndOrder`, `closePartial`, `getPosition`.
7. `contracts/interfaces/IUniswapV2Router.sol` — minimal interface for `addLiquidity`.

### Deploy / Config
8. `contracts/script/Deploy.s.sol` — Foundry script: deploy KeeperRegistry → LaunchpadFactory; write addresses to `src/contracts.json`.
9. `src/contracts.json` — deployed addresses (written by deploy script).

### Keeper Script
10. `scripts/keeper.ts` — 15-second tick loop: enumerate active coins, claim+split, check P&L, branch profit-take vs add-margin.

### Frontend
11. `src/config.ts` — wagmi config for Arc Testnet, ConnectKit setup. (modify existing)
12. `src/App.tsx` — router: `/`, `/launch`, `/coin/:address`. (modify existing)
13. `src/pages/LaunchFeed.tsx` — scrollable card grid of all launched coins; live market cap ticker from BondingCurve events.
14. `src/pages/LaunchForm.tsx` — create-coin form: name, ticker, target market (9 options), leverage slider (1–25×), creator fee destination (burn vs LP).
15. `src/pages/CoinDetail.tsx` — bonding curve chart (recharts), buy/sell swap widget, perp position card (collateral, P&L, open leverage), fee split bar, keeper event log.
16. `src/components/BuySellPanel.tsx` — amount input, price impact, 1% fee preview, submit with wagmi `writeContract`.
17. `src/components/PerpPositionCard.tsx` — live position stats polled from KeeperRegistry; color-coded P&L.
18. `src/components/FeeSplitBar.tsx` — visual 50/15/20/15 bar with live USDC amounts.
19. `src/components/KeeperLog.tsx` — event feed for `FeeClaimed`, `MarginAdded`, `ProfitTaken`, `BuybackBurned`.
20. `src/components/CoinCard.tsx` — card used in the launch feed; shows ticker, market cap progress bar, perp status badge.

## Build Sequence
1. **Write and audit contracts** — Token → SubWallet → BondingCurve → LaunchpadFactory → KeeperRegistry → interfaces. Run balanced audit (critical + high + Slither). Fix findings.
2. **Deploy to Arc Testnet** — run `Deploy.s.sol` via Foundry against `ARC_TESTNET_RPC_URL`; write addresses to `src/contracts.json`.
3. **Wire wagmi config** — update `src/config.ts` with Arc Testnet chain, USDC address, and deployed contract addresses.
4. **Build launch feed + create form** — `LaunchFeed.tsx`, `LaunchForm.tsx`, `CoinCard.tsx`. Reads `LaunchpadFactory` events for the coin list.
5. **Build coin detail page** — `CoinDetail.tsx`, `BuySellPanel.tsx`, `PerpPositionCard.tsx`, `FeeSplitBar.tsx`, `KeeperLog.tsx`. All live data from wagmi `useReadContract` + event logs.
6. **Build and test keeper script** — `scripts/keeper.ts`; run against testnet with a test coin; confirm fee claim, split, and mock Hyperliquid margin top-up.
7. **Polish UI** — Arc Dark theme, bonding curve sparkline, animated market-cap progress bar, keeper event toast notifications.

## Done When
- [ ] All 5 contracts compile clean with no critical or high audit findings
- [ ] `LaunchpadFactory` deploys a new Token + SubWallet + BondingCurve in one transaction on Arc Testnet
- [ ] Buy and sell on the bonding curve correctly applies 1% fee and updates price
- [ ] Fee split of 50/15/20/15 is enforced on-chain; SubWallet holds the margin slice
- [ ] KeeperRegistry emits events the UI reads in real time
- [ ] Graduation threshold triggers the Uniswap V2 migration call
- [ ] Keeper script correctly branches: adds margin in drawdown, calls `takeProfitSlice` at +50%
- [ ] Launch feed shows all coins with live market-cap progress
- [ ] Coin detail page shows bonding curve chart, perp card, fee split, and keeper log
- [ ] ConnectKit wallet connects on Arc Testnet; buy/sell transactions confirm
