Good. Here is the fully updated plan:

---

## infinite.fun — Updated Implementation Plan

### Summary
A token launchpad on Arc Testnet where every launched ERC-20 is backed by a live leveraged perpetual position. A bonding curve funds the position from fees; a keeper loop claims fees, splits them 50/15/20/15, tops up margin, and burns supply on profit-takes. The backend (Express 5 + PostgreSQL 14) stores event history, coin metadata, and position snapshots; the frontend reads from the API instead of raw RPC for most data. Hyperliquid is the perp routing destination. Deployed on Ubuntu 22 behind nginx 1.18.

---

### Architecture

**Blockchain:** Arc Testnet (chain ID 5042002). USDC native gas token, sub-second finality.

**Contracts (5):**
1. `LaunchpadFactory.sol` — CREATE2 deploys Token + SubWallet + BondingCurve per coin. Stores 50/15/20/15 fee split in basis points. Opens perp once $20 collateral accrues.
2. `Token.sol` — ERC-20, fixed 1B supply, no mint. `burn()` callable only by the coin's SubWallet.
3. `BondingCurve.sol` — xy=k curve, 1% flat fee, graduates at 4.2 ETH-equivalent USDC, migrates LP to Uniswap V2 on graduation.
4. `SubWallet.sol` — per-coin USDC treasury, CREATE2 derived. Keeper-only ACL on `claimAndSplit`, `addMargin`, `openPosition`, `takeProfitSlice`, `burnBuyback`. Calls Hyperliquid bridge for perp ops.
5. `KeeperRegistry.sol` — keeper address ACL, coin→SubWallet map, coin state (pendingFees, collateral, positionSize, openPrice). Emits events the backend indexes.

**Backend (Express 5 + TypeScript 5 + PostgreSQL 14):**
- Single Node/Bun process: Express API server + keeper tick loop (15s interval) in one process, sharing one DB connection pool.
- Keeper indexes all on-chain events into Postgres; API serves them to the frontend.
- Image uploads stored to local disk; nginx serves them as static files.
- Discord webhook notifications on graduation, profit-take, and near-liquidation events.

**Frontend:** Vite + React + TypeScript + Tailwind. Arc Dark mode. Reads coin list, metadata, event history, and position snapshots from the Express API. Writes (buy, sell, launch coin) go direct to chain via wagmi + ConnectKit.

**Server layout (Ubuntu 22):**
```
/var/www/infinite.fun/        ← dist/ (nginx static)
/var/www/infinite.fun/images/ ← coin images (nginx static)
/home/ubuntu/infinite-fun/    ← backend source + .env
  server/                     ← Express API + keeper
  scripts/                    ← deploy, migrate, etc.
```
Keeper + API run under pm2. nginx proxies `/api/*` to Express (port 3001), serves everything else as static.

---

### Database Schema (PostgreSQL 14)

```sql
coins          (address PK, name, ticker, description, image_url, creator,
                market, leverage, fee_dest, launched_at, graduated_at,
                graduation_pool)

keeper_events  (id, coin_address FK, event_type, usdc_amount, tx_hash,
                block_number, created_at)
               -- event_type: fee_claimed | margin_added | profit_taken |
               --             buyback_burned | position_opened | graduated

position_snapshots (id, coin_address FK, collateral, position_size,
                    entry_price, mark_price, unrealized_pnl, snapshotted_at)
               -- written every keeper tick per active coin

leaderboard_cache (coin_address PK, total_fees_claimed, total_burned,
                   total_pnl, updated_at)
               -- materialized by keeper after each tick
```

---

### Files to Create / Modify

**Contracts**
1. `contracts/Token.sol`
2. `contracts/SubWallet.sol`
3. `contracts/BondingCurve.sol`
4. `contracts/LaunchpadFactory.sol`
5. `contracts/KeeperRegistry.sol`
6. `contracts/interfaces/IHyperliquidBridge.sol`
7. `contracts/interfaces/IUniswapV2Router.sol`
8. `contracts/script/Deploy.s.sol`

**Backend**
9. `server/index.ts` — Express 5 app entry; mounts routes; starts keeper tick loop.
10. `server/db.ts` — `pg` pool, typed query helpers.
11. `server/keeper/tick.ts` — 15s interval: enumerate active coins, call chain, write events + snapshots to DB, fire Discord webhooks.
12. `server/keeper/hyperliquid.ts` — Hyperliquid read/write API client (position query, margin deposit, partial close).
13. `server/routes/coins.ts` — `GET /api/coins`, `GET /api/coins/:address`, `POST /api/coins` (metadata at launch).
14. `server/routes/events.ts` — `GET /api/coins/:address/events`, `GET /api/coins/:address/snapshots`.
15. `server/routes/leaderboard.ts` — `GET /api/leaderboard`.
16. `server/routes/upload.ts` — `POST /api/upload` (multipart image → `/var/www/infinite.fun/images/`).
17. `server/routes/feed.ts` — `GET /api/feed` (all coins + latest snapshot, paginated, for launch feed).
18. `server/migrations/001_initial.sql` — full schema DDL.
19. `server/notify.ts` — Discord webhook helper; called by keeper on graduation / profit-take / near-liquidation.

**Deploy / Config**
20. `src/contracts.json` — written by deploy script; imported by frontend and server.
21. `.env.example` — all required vars documented.
22. `deploy/nginx.conf` — nginx site config: static root, `/api` proxy pass to 3001, `/images` static alias, gzip, cache headers.
23. `deploy/infinite-fun.service` — systemd unit (alternative to pm2) for the backend process.
24. `deploy/README.md` — step-by-step self-host instructions: clone, `bun install`, `psql < migrations/001_initial.sql`, set `.env`, `bun run build`, pm2/systemd start, nginx symlink.

**Frontend**
25. `src/config.ts` — wagmi + ConnectKit for Arc Testnet. *(modify)*
26. `src/App.tsx` — router: `/`, `/launch`, `/coin/:address`, `/leaderboard`. *(modify)*
27. `src/api.ts` — typed fetch client for all Express endpoints.
28. `src/pages/LaunchFeed.tsx` — card grid from `GET /api/feed`; live market cap bars.
29. `src/pages/LaunchForm.tsx` — name, ticker, description, image upload, market selector (9), leverage slider, fee destination toggle.
30. `src/pages/CoinDetail.tsx` — bonding curve chart, buy/sell panel, perp position card, fee split bar, keeper event log, P&L history chart.
31. `src/pages/Leaderboard.tsx` — top coins by total burned, total P&L, total fees.
32. `src/components/BuySellPanel.tsx` — wagmi `writeContract` buy/sell; price impact preview.
33. `src/components/PerpPositionCard.tsx` — polls `/api/coins/:address/snapshots`; color-coded P&L.
34. `src/components/FeeSplitBar.tsx` — 50/15/20/15 bar with live USDC totals from event history.
35. `src/components/KeeperLog.tsx` — event feed from `/api/coins/:address/events`.
36. `src/components/CoinCard.tsx` — ticker, market cap progress bar, perp status badge.

---

### Build Sequence

1. **Contracts** — write all 5 + interfaces. Balanced audit (critical + high + Slither). Fix findings. Deploy to Arc Testnet. Write addresses to `src/contracts.json`.
2. **Database** — write `001_initial.sql` migration. Document `psql` setup in deploy README.
3. **Backend core** — `db.ts`, `index.ts`, keeper tick loop, Hyperliquid client, Discord notify.
4. **Backend routes** — coins, events, snapshots, leaderboard, upload, feed.
5. **nginx + deploy config** — `nginx.conf`, systemd unit, deploy README.
6. **Frontend wiring** — `src/api.ts`, `src/config.ts`, `App.tsx` router.
7. **Frontend pages** — LaunchFeed → LaunchForm → CoinDetail → Leaderboard.
8. **Frontend components** — BuySellPanel → PerpPositionCard → FeeSplitBar → KeeperLog → CoinCard.
9. **Polish** — Arc Dark theme, recharts P&L sparklines, animated progress bars, toast notifications on keeper events.

---

### Done When
- [ ] All 5 contracts compile, pass balanced audit, deploy to Arc Testnet
- [ ] LaunchpadFactory deploys Token + SubWallet + BondingCurve in one tx
- [ ] 1% bonding curve fee correctly splits 50/15/20/15 on-chain
- [ ] Keeper tick loop runs, writes all event types to Postgres, snapshots position every 15s
- [ ] Keeper branches correctly: `takeProfitSlice` at +50%, `addMargin` in drawdown
- [ ] Graduation threshold fires Uniswap V2 migration + writes `graduated_at` to DB
- [ ] Discord webhooks fire on graduation, profit-take, near-liquidation
- [ ] All Express routes return correct typed responses
- [ ] Image upload stores file, returns URL
- [ ] Frontend launch feed loads from API, shows live market cap progress
- [ ] Coin detail shows P&L chart from snapshots, event log from keeper_events
- [ ] Leaderboard ranks by total burned and total P&L
- [ ] ConnectKit connects on Arc Testnet; buy/sell/launch transactions confirm
- [ ] nginx config proxies `/api` correctly, serves `dist/` and `/images` as static
- [ ] Deploy README covers full Ubuntu 22 setup end to end

---

Plan saved. Switch to **Build mode** to start — contracts first, then backend, then frontend.
