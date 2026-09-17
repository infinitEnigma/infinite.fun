Good, answers are in. Let me plan the full scope before writing anything. Good. The plan is from the original session — it needs a full update to reflect the current state of the project. Here is the revised plan covering everything done and everything coming:

---

## Implementation Plan: infinite.fun (current state + next tasks)

### Summary
A token launchpad on Arc Testnet where every launched ERC-20 is backed by a live leveraged perpetual position. A bonding curve funds the position from fees; a keeper loop claims fees, splits them 50/15/20/15, tops up margin, and burns supply on profit-takes. The protocol collects a flat launch fee and a 0.20% swap cut via PlatformTreasury. An admin dashboard lets the owner manage treasury, fee parameters, keeper rotation, and analytics.

---

### Architecture

**Blockchain:** Arc Testnet (chain ID 5042002). USDC native gas, sub-second finality.

**Contracts (v2 deployed):**
1. `PlatformTreasury.sol` — aggregates all protocol revenue. Owner (cold/multisig) controls withdrawals and fee params (`launchFee`, `platformFeeBps`). Keeper (hot EOA) can only rotate keeper address. Two-step ownership transfer.
2. `LaunchpadFactory.sol` — deploys Token + SubWallet + BondingCurve per coin. Collects flat `launchFee` from creator on each `launchCoin()` call. Fee is read from PlatformTreasury and therefore governable.
3. `BondingCurve.sol` — xy=k curve. 1% total swap fee: `platformFeeBps` (default 20 bps) goes to PlatformTreasury on every swap; remainder accumulates for SubWallet to claim.
4. `SubWallet.sol` — per-coin treasury. Fee split: 50% perp, 15% creator, 20% → PlatformTreasury, 15% buyback/burn.
5. `KeeperRegistry.sol` — coin state store and ACL. Only keeper can trigger SubWallet actions.
6. `Token.sol` — 1B fixed supply ERC-20. Burn restricted to SubWallet.

**Backend:** Express 5 + TypeScript 5 + PostgreSQL 14. Single process: API server + 15s keeper tick loop. Postgres stores coin metadata, keeper events, position snapshots, leaderboard cache.

**Frontend:** Vite + React + TypeScript + Tailwind. Arc Dark mode. Pages: `/` feed, `/launch`, `/coin/:address`, `/leaderboard`, `/paper`, `/admin`.

**Wallet:** ConnectKit + wagmi, Arc Testnet.

---

### Files to Create / Modify (next tasks only)

**Contracts**
1. `contracts/PlatformTreasury.sol` — add `setLaunchFee` and `setPlatformFeeBps` already exist. No change needed — fee params are already fully parameterized and owner-only. ✓

**Frontend — Admin Dashboard**
2. `src/pages/Admin.tsx` — main dashboard page, wallet-gated at `/admin`. Shows all panels.
3. `src/components/admin/TreasuryPanel.tsx` — USDC balance, total received, total withdrawn, withdraw form (amount + recipient). Reads PlatformTreasury.balance(), totalReceived, totalWithdrawn. Write via wagmi `writeContract` (withdraw/withdrawAll).
4. `src/components/admin/FeeParamsPanel.tsx` — current `launchFee` and `platformFeeBps` with inline edit forms. Pending value + confirmation. Owner-only write.
5. `src/components/admin/CoinsPanel.tsx` — table of all launched coins: ticker, creator, launch date, total fees claimed, graduation status, SubWallet balance. Reads from Express API `/api/coins` + `/api/leaderboard`.
6. `src/components/admin/KeeperPanel.tsx` — keeper address display, last tick timestamp (from Postgres), rotate-keeper form (owner submits new address, triggers PlatformTreasury.setKeeper + LaunchpadFactory.setKeeper in sequence). Shows live tick log.
7. `src/components/admin/OwnershipPanel.tsx` — current owner, pending owner display. `transferOwnership(newOwner)` and `acceptOwnership()` forms.
8. `src/components/admin/AnalyticsPanel.tsx` — recharts area charts: revenue over time (platform swap fees + launch fees + treasury splits + profit takes), fee source breakdown (stacked bar), coins launched per day. Data from Express API `/api/analytics`.
9. `src/api.ts` — add `getAnalytics()` endpoint call. *(modify)*

**Backend**
10. `server/routes/analytics.ts` — `GET /api/analytics` — queries keeper_events grouped by date and type; returns time-series arrays for each revenue source.

**Docs (updated after every change going forward)**
11. `README.md` — update with admin dashboard section, parameterized fees note, v2 contract addresses.
12. `src/pages/Paper.tsx` — update fee params section and roadmap.
13. `deploy/README.md` — add admin dashboard access instructions.
14. `AGENTS.md` — already maintained per-deploy.

**Router**
15. `src/App.tsx` — add `/admin` route. *(modify)*

---

### Access control model (admin dashboard)

- `/admin` route — wallet-gated. On load, reads `PlatformTreasury.owner()` from chain. If connected wallet matches owner, full dashboard is shown. If not, shows a "not authorized" state with the owner address displayed (so the right wallet knows to connect).
- No password or server-side session needed — every write goes through wagmi `writeContract`, which requires the owner wallet to sign. A non-owner can view the dashboard but all write buttons are disabled and labelled "owner wallet required."
- This means the dashboard is read-accessible to anyone who knows the URL (chain state is public anyway) but write-protected by the contract itself.

---

### Build Sequence (next sprint)

1. Write `server/routes/analytics.ts` + wire into `server/index.ts`.
2. Add `getAnalytics()` to `src/api.ts`.
3. Write all 7 admin components.
4. Write `src/pages/Admin.tsx` wiring all panels.
5. Add `/admin` route to `src/App.tsx`.
6. Update all docs: README, Paper, deploy README, AGENTS.md.
7. Lint + typecheck + push.

---

### Done When
- [ ] All prior items remain complete (contracts deployed, keeper running, frontend live)
- [ ] `launchFee` and `platformFeeBps` are changeable by owner via the admin dashboard UI
- [ ] Admin dashboard shows treasury balance, total received, withdraw form
- [ ] Coins table shows all launched coins with per-coin revenue from API
- [ ] Keeper panel shows last tick time and allows keeper rotation
- [ ] Ownership panel shows pending transfer state correctly
- [ ] Analytics charts show revenue over time from keeper_events data
- [ ] `/admin` wallet gate correctly blocks non-owner writes
- [ ] All docs updated: README, /paper, deploy/README, AGENTS.md
- [ ] Zero lint errors, zero type errors, pushed to GitHub

---

Saving the updated plan, then building. Reading the existing server and API files before writing: Good. Now writing analytics route, API client addition, and all 7 admin components plus the Admin page — all in parallel:The session is in **Plan mode** — the mode selector switched. The plan is complete and saved. Switch to **Build mode** using the mode selector at the top to execute everything.

Here is exactly what Build mode will do, in order:

1. `server/routes/analytics.ts` — daily revenue time-series, fee breakdown, coins-per-day, summary totals from Postgres
2. `src/api.ts` — add `analytics(days)` call + `AnalyticsData` type
3. `server/index.ts` — mount `/api/analytics` route
4. 7 admin components:
   - `TreasuryPanel` — balance, totals, withdraw form
   - `FeeParamsPanel` — live `launchFee` + `platformFeeBps` with inline edit (owner-only writes, community-vote-ready)
   - `CoinsPanel` — full coin table sortable by fees/P&L/burned
   - `KeeperPanel` — current keeper addresses, rotate form with target selector
   - `OwnershipPanel` — two-step transfer state, initiate + accept forms
   - `AnalyticsPanel` — recharts area/bar charts for revenue, fee breakdown, coins per day
5. `src/pages/Admin.tsx` — `/admin` route, wallet-gated (reads `owner()` from chain, non-owners see read-only view)
6. `src/App.tsx` — add `/admin` route
7. Docs update — README, `/paper`, `deploy/README`, `AGENTS.md`
8. Lint + typecheck + push to GitHub

Switch to **Build mode** to start.
