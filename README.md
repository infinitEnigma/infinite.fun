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
3. **Fee split (50 / 15 / 20 / 15)**
   - 50% — perp margin (SubWallet holds USDC collateral for the Hyperliquid position)
   - 15% — creator fee recipient
   - 20% — protocol treasury
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
│   ├── BondingCurve.sol        xy=k AMM, 1% fee, graduation threshold
│   ├── SubWallet.sol           Per-coin USDC treasury + Hyperliquid bridge calls
│   ├── KeeperRegistry.sol      Coin registry, keeper ACL, state store
│   ├── LaunchpadFactory.sol    Deploys Token + BondingCurve + SubWallet per coin
│   └── interfaces/             IHyperliquidBridge, IUniswapV2Router
├── server/                     Express 5 + TypeScript backend
│   ├── index.ts                App entry + keeper tick loop startup
│   ├── db.ts                   PostgreSQL 14 connection pool
│   ├── keeper/
│   │   ├── tick.ts             15s keeper: claim, split, P&L check, profit-take
│   │   └── hyperliquid.ts      Hyperliquid read/write API client
│   ├── notify.ts               Discord webhook notifications
│   ├── routes/                 REST API: coins, events, snapshots, leaderboard, upload
│   └── migrations/
│       └── 001_initial.sql     Full PostgreSQL schema
├── src/                        Vite + React + TypeScript frontend
│   ├── pages/                  LaunchFeed, LaunchForm, CoinDetail, Leaderboard
│   ├── components/             BuySellPanel, CoinCard, PerpPositionCard, FeeSplitBar, KeeperLog
│   ├── api.ts                  Typed fetch client for all Express endpoints
│   └── contracts.json          Deployed contract addresses
└── deploy/
    ├── nginx.conf              nginx site config (SSL, proxy, static, gzip)
    ├── infinite-fun.service    systemd unit for the backend process
    └── README.md               Full Ubuntu 22 self-host guide
```

---

## Deployed Contracts (Arc Testnet)

| Contract | Address |
|---|---|
| KeeperRegistry | `0xfd8B9Ddb776Bd1608F1774255B7FE2caf674fa08` |
| LaunchpadFactory | `0x937a4C48E3C50875AF19825B177d6A71b5194C31` |
| USDC (Arc Testnet) | `0x3600000000000000000000000000000000000000` |

Chain ID: `5042002`

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
