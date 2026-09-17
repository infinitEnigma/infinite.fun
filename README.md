# infinite.fun

> Every token launch backs a live leveraged position. Forever.

A token launchpad on Arc Testnet where every ERC-20 you launch is backed by a perpetual
position on Hyperliquid. Bonding curve fees fund the position continuously — the keeper
claims fees, splits them 50/15/20/15, tops up margin, and burns supply on profit-takes.
No manual management required.

Inspired by the [Perps Hood paper](https://perpshood.fun/paper).

---

## How It Works

1. **Launch a coin** — pick a name, ticker, target market, and leverage (1–25x).
2. **Bonding curve** — buyers and sellers trade on an xy=k curve with a 1% fee.
3. **Platform fees** — every swap pays a 0.20% platform cut directly to PlatformTreasury.
   A flat launch fee (default 10 USDC, governance-adjustable) is charged at coin creation.
4. **Fee split (50 / 15 / 20 / 15)** on the remaining bonding curve fee:
   - 50% — perp margin (SubWallet holds USDC collateral for the Hyperliquid position)
   - 15% — creator fee recipient
   - 20% — PlatformTreasury (aggregates protocol revenue across all coins)
   - 15% — buyback-and-burn (or LP, creator's choice)
4. **Keeper loop** — runs every 15 seconds; claims fees, posts margin, takes 25% profit
   at +50% P&L, burns the proceeds to reduce supply.
5. **Graduation** — once the curve crosses the USDC threshold, liquidity migrates to a
   Uniswap V2 pool and the coin trades freely.

---

## Architecture

```
infinite.fun/
├── contracts/                  Solidity (Foundry)
│   ├── Token.sol               ERC-20, 1B fixed supply, burn via SubWallet only
│   ├── BondingCurve.sol        xy=k AMM, 1% swap fee (0.20% to PlatformTreasury), graduation threshold
│   ├── SubWallet.sol           Per-coin USDC treasury + Hyperliquid bridge calls
│   ├── KeeperRegistry.sol      Coin registry, keeper ACL, state store
│   ├── LaunchpadFactory.sol    Deploys Token + BondingCurve + SubWallet per coin; collects launch fee
│   ├── PlatformTreasury.sol    Aggregates all protocol revenue; owner/keeper role separation
│   └── interfaces/             IHyperliquidBridge, IUniswapV2Router
├── server/                     Express 5 + TypeScript backend
│   ├── index.ts                App entry + keeper tick loop startup
│   ├── db.ts                   PostgreSQL 14 connection pool
│   ├── keeper/
│   │   ├── tick.ts             15s keeper: claim, split, P&L check, profit-take
│   │   └── hyperliquid.ts      Hyperliquid read/write API client
│   ├── notify.ts               Discord webhook notifications
│   ├── routes/                 REST API: coins, events, snapshots, leaderboard, upload, analytics, portfolio, prices
│   └── migrations/
│       └── 001_initial.sql     Full PostgreSQL schema
├── src/                        Vite + React + TypeScript frontend
│   ├── pages/                  LaunchFeed, LaunchForm, CoinDetail, Leaderboard, Paper, Admin, Portfolio
│   ├── components/             BuySellPanel, CoinCard, PerpPositionCard, FeeSplitBar, KeeperLog,
│   │                           PriceStrip (Pyth live prices, reverse ticker), MarketBar (9-market filter),
│   │                           admin/{TreasuryPanel, FeeParamsPanel, CoinsPanel, KeeperPanel,
│   │                                  OwnershipPanel, AnalyticsPanel}
│   ├── api.ts                  Typed fetch client for all Express endpoints
│   └── contracts.json          Deployed contract addresses
└── deploy/
    ├── nginx.conf              nginx site config (SSL, proxy, static, gzip)
    ├── infinite-fun.service    systemd unit for the backend process
    └── README.md               Full Ubuntu 22 self-host guide
```

---

## Deployed Contracts (Arc Testnet — Chain ID 5042002)

| Contract | Address |
|---|---|
| PlatformTreasury | `0x3cb9f3E17cfF1FeaB02F8a09c7d8c7755c7777Fd` |
| KeeperRegistry   | `0x51DA850AB51a15624553ABcbAF408B63223B0897` |
| LaunchpadFactory | `0x919fb3Bf0A66B48c64e8b3857C610C3C2bc0F62A` |
| USDC (Arc Testnet) | `0x3600000000000000000000000000000000000000` |

## Admin Dashboard

The admin dashboard is available at `/admin`. It is wallet-gated: connect the owner wallet to unlock write operations.

| Panel | What it controls |
|---|---|
| Treasury | USDC balance, total received/withdrawn, withdraw funds |
| Fee Params | `launchFee` and `platformFeeBps` (governance-adjustable, owner-only) |
| Coins | Table of all launched coins with per-coin revenue stats |
| Keeper | Current keeper addresses, last tick, rotate keeper |
| Ownership | Two-step ownership transfer: initiate + accept |
| Analytics | Revenue charts, fee breakdown, coins-per-day |

Non-owners can view all read-only data; write buttons require the owner wallet signature.

---

## Local Development

### Prerequisites

- [Bun](https://bun.sh) v1.x
- [Foundry](https://getfoundry.sh)
- PostgreSQL 14+
- Node 20+ (for Circle CLI only)

### Setup

```bash
git clone https://github.com/infinitEnigma/infinite.fun.git
cd infinite.fun
bun install
```

Copy the example env and fill in your values:

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, wallet_pk, KEEPER_ADDRESS, DISCORD_WEBHOOK_URL
```

Run the database migration:

```bash
psql -U postgres -d infinityfun -f server/migrations/001_initial.sql
```

Start the frontend (Vite dev server):

```bash
bun run dev
```

Start the backend + keeper (separate terminal):

```bash
bun run server/index.ts
```

### Build for production

```bash
bun run build          # produces dist/
```

---

## Self-Hosting on Ubuntu 22

See [`deploy/README.md`](deploy/README.md) for the full step-by-step guide covering:

- nginx 1.18 config with SSL, static file serving, and `/api` proxy
- systemd unit or pm2 process management
- PostgreSQL 14 setup
- Foundry contract deployment
- Environment variable reference

---

## Contract Deployment

```bash
forge build

forge script contracts/script/Deploy.s.sol:Deploy \
  --rpc-url https://rpc.testnet.arc.io \
  --private-key <YOUR_KEY> \
  --broadcast \
  --legacy \
  -vvv
```

Deployed addresses are written to `src/contracts.json` automatically.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Blockchain | Arc Testnet (USDC native gas) |
| Contracts | Solidity 0.8.28, Foundry, OpenZeppelin 5 |
| Perp routing | Hyperliquid bridge |
| AMM graduation | Uniswap V2 |
| Backend | Express 5, TypeScript 5, Bun |
| Database | PostgreSQL 14 |
| Frontend | Vite, React 18, TypeScript, Tailwind CSS |
| Wallet | wagmi v2, ConnectKit |
| Notifications | Discord webhooks |
| Server | Ubuntu 22, nginx 1.18 |

---

## Fee Split

```
Bonding curve fee (1% of every swap)
    │
    ├── 50% ──► SubWallet (perp margin on Hyperliquid)
    ├── 15% ──► Creator fee recipient
    ├── 20% ──► Protocol treasury
    └── 15% ──► Buyback-and-burn  (or LP accumulation, creator's choice)
```

---

## Keeper Lifecycle

```
every 15s:
  for each active coin:
    1. claimFees()         pull accumulated curve fees into SubWallet
    2. claimAndSplit()     enforce 50/15/20/15 split
    3. if !positionOpen && collateral >= $20:
         openPosition()   open perp on Hyperliquid
    4. read P&L from Hyperliquid API
       if pnl >= +50%:
         takeProfitSlice() close 25%, route 75% to buyback+burn
       elif drawdown severe:
         addMargin()       top up collateral from SubWallet balance
    5. write event + snapshot to PostgreSQL
    6. if near liquidation: fire Discord webhook
```

---

## Security Notes

- All SubWallet fund-moving functions are `onlyKeeper` — the keeper EOA is the single privileged actor.
- `Token.burn()` is callable only by the coin's SubWallet — no external burn path.
- `BondingCurve` graduation is one-way and irreversible.
- `SubWallet.withdrawTo()` routes only to the registered treasury address — no arbitrary recipient.
- `Token.setSubWallet()` and `Token.setBondingCurve()` are one-time setters called by the factory at launch — cannot be changed after.
- All USDC transfers use OpenZeppelin `SafeERC20.safeTransfer` / `forceApprove`.

**This code has received a balanced internal audit (critical + high severity). It has NOT been independently audited by a third party. Use on mainnet at your own risk.**

---

## License

[GPL-3.0-or-later](LICENSE)
