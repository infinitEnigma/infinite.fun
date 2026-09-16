# infinite.fun — Self-Hosting Guide (Ubuntu 22 + nginx 1.18)

## Requirements

- Ubuntu 22.04
- nginx 1.18 (pre-installed)
- PostgreSQL 14 (pre-installed)
- Bun (install: `curl -fsSL https://bun.sh/install | bash`)
- pm2 (`bun add -g pm2`)

---

## 1. Clone the repo

```bash
git clone https://github.com/YOUR_USER/infinite.fun.git /home/ubuntu/infinite-fun
cd /home/ubuntu/infinite-fun
bun install
```

---

## 2. Set up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER infiniteFun WITH PASSWORD 'STRONG_PASS';"
sudo -u postgres psql -c "CREATE DATABASE infinite_fun OWNER infiniteFun;"
psql -U infiniteFun -d infinite_fun -f server/migrations/001_initial.sql
```

---

## 3. Configure environment

```bash
cp .env.example .env
# Edit .env — fill in all values before proceeding
nano .env
```

Required variables (see `.env.example` for full list):

```
DATABASE_URL=postgresql://infiniteFun:STRONG_PASS@localhost:5432/infinite_fun
KEEPER_PRIVATE_KEY=0x...
VITE_FACTORY_ADDRESS=0x...      # from deploy step
VITE_REGISTRY_ADDRESS=0x...     # from deploy step
PORT=3001
CORS_ORIGIN=https://infinite.fun
UPLOAD_DIR=/var/www/infinite.fun/images
IMAGES_BASE_URL=https://infinite.fun/images
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...  # optional
```

---

## 4. Deploy contracts to Arc Testnet

```bash
# Add ARC_TESTNET_RPC_URL and PRIVATE_KEY to .env first
bun run scripts/self-deploy.ts
# Or with Foundry directly:
forge script contracts/script/Deploy.s.sol --rpc-url $ARC_TESTNET_RPC_URL --broadcast
# Copy the printed REGISTRY= and FACTORY= addresses into .env as VITE_REGISTRY_ADDRESS / VITE_FACTORY_ADDRESS
```

---

## 5. Build the frontend

```bash
bun run build
# Output is in dist/
```

---

## 6. Copy static files

```bash
sudo mkdir -p /var/www/infinite.fun /var/www/infinite.fun/images
sudo cp -r dist/. /var/www/infinite.fun/
sudo chown -R www-data:www-data /var/www/infinite.fun
sudo chmod -R 755 /var/www/infinite.fun
```

---

## 7. Configure nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/infinite.fun
sudo ln -s /etc/nginx/sites-available/infinite.fun /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

> Add your TLS certificate paths to `nginx.conf` (lines `ssl_certificate` and `ssl_certificate_key`).  
> Use [Certbot](https://certbot.eff.org/) for a free Let's Encrypt cert: `sudo certbot --nginx -d infinite.fun`

---

## 8. Start the backend with pm2

```bash
pm2 start "bun run server/index.ts" --name infinite-fun-server --cwd /home/ubuntu/infinite-fun
pm2 save
pm2 startup  # follow the printed command to enable on boot
```

Check logs:
```bash
pm2 logs infinite-fun-server
```

---

## 9. Verify

```bash
curl https://infinite.fun/api/health   # should return {"ok":true,...}
pm2 status                              # server should be "online"
```

---

## Updating

```bash
cd /home/ubuntu/infinite-fun
git pull --ff-only
bun install
bun run build
sudo cp -r dist/. /var/www/infinite.fun/
pm2 restart infinite-fun-server
```

---

## Keeper

The keeper loop starts automatically inside the Express server process (same pm2 process). It polls every 15 seconds per active coin. To run it standalone instead:

```bash
pm2 start "bun run server/keeper/tick.ts" --name infinite-fun-keeper --cwd /home/ubuntu/infinite-fun
```

The keeper requires:
- `KEEPER_PRIVATE_KEY` — the EOA that is the keeper in the deployed contracts
- `VITE_FACTORY_ADDRESS` / `VITE_REGISTRY_ADDRESS` — deployed contract addresses
- `DATABASE_URL` — Postgres connection string
- `HYPERLIQUID_API_URL` — Hyperliquid testnet info endpoint (default: `https://api.hyperliquid-testnet.xyz/info`)
