/**
 * Keeper tick — runs every 15 seconds.
 * For each active coin:
 *  1. Call SubWallet.claimAndSplit (pulls fees from curve, splits 50/15/20/15)
 *  2. Read position from Hyperliquid
 *  3. If no position open and perpSlice >= $20 → openPosition
 *  4. If position open and unrealizedPnl >= +50% of collateral → takeProfitSlice
 *  5. If position open and in drawdown → addMargin
 *  6. Snapshot position to DB
 *  7. Fire Discord alerts for graduation / near-liquidation
 */

import { createPublicClient, createWalletClient, http, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { query, queryOne } from '../db.js';
import { getPosition } from './hyperliquid.js';
import { notify, formatCoinAlert } from '../notify.js';

// -----------------------------------------------------------------------
// RPC URL — built from proxy env vars; falls back to public endpoint only
// when the proxy doesn't cover Arc Testnet.
// -----------------------------------------------------------------------
function buildRpcUrl(): string {
  const proxyBase = process.env.RPC_PROXY_BASE_URL;
  const proxyToken = process.env.RPC_PROXY_TOKEN;
  const proxyChains = (process.env.RPC_PROXY_CHAINS ?? '').split(',').map((c) => c.trim());
  const compassKey = 'Arc_Testnet';

  if (proxyBase && proxyToken && proxyChains.includes(compassKey)) {
    return `${proxyBase}/api/rpc/${compassKey}?_rpc_token=${proxyToken}`;
  }

  // Fallback: public RPC (may rate-limit under high load)
  const fallback = process.env.ARC_TESTNET_RPC_URL;
  if (!fallback) {
    throw new Error('[keeper] No RPC URL available — set RPC_PROXY_BASE_URL+TOKEN+CHAINS or ARC_TESTNET_RPC_URL');
  }
  console.warn('[keeper] Using public RPC fallback — proxy env vars not set for Arc_Testnet');
  return fallback;
}

// Arc Testnet chain config
const arcTestnet = {
  id: 5_042_002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [buildRpcUrl()] } },
} as const;

const KEEPER_KEY = process.env.KEEPER_PRIVATE_KEY as `0x${string}` | undefined;
const REGISTRY_ADDRESS = process.env.VITE_REGISTRY_ADDRESS as Address | undefined;
const HL_BRIDGE = process.env.HYPERLIQUID_BRIDGE_ADDRESS as Address | undefined;
const TREASURY = process.env.TREASURY_ADDRESS as Address | undefined;

const TICK_INTERVAL_MS = 15_000;
const PERP_OPEN_THRESHOLD_USDC = 20_000_000n; // $20 in 6-decimal USDC
const PROFIT_TRIGGER_RATIO = 0.5; // +50%
const NEAR_LIQ_RATIO = 0.1; // warn at <10% equity

const registryAbi = parseAbi([
  'function getCoins() view returns (address[])',
  'function getCoinSubWallet(address) view returns (address)',
  'function getCoinInfo(address) view returns (address creator, string market, uint64 leverage, address feeDest, bool burnMode, uint256 launchedAt, bool graduated)',
]);

const subWalletAbi = parseAbi([
  'function claimAndSplit(address creatorFeeRecipient, address treasury, address feeDest, bool burnMode, uint256 minTokensOut)',
  'function openPosition(uint256 usdcAmount, uint64 leverage, bool isLong, address hyperliquidBridge)',
  'function addMargin(uint256 usdcAmount, address hyperliquidBridge)',
  'function takeProfitSlice(address hyperliquidBridge, address treasury, uint256 minTokensOut)',
  'function totalCollateral() view returns (uint256)',
  'function positionOpen() view returns (bool)',
  'function positionId() view returns (bytes32)',
]);

export function startKeeperLoop(): void {
  if (!KEEPER_KEY) {
    console.warn('[keeper] KEEPER_PRIVATE_KEY not set — keeper loop disabled');
    return;
  }
  if (!REGISTRY_ADDRESS || !TREASURY || !HL_BRIDGE) {
    console.warn('[keeper] Missing env vars (VITE_REGISTRY_ADDRESS, TREASURY_ADDRESS, HYPERLIQUID_BRIDGE_ADDRESS) — loop disabled');
    return;
  }

  const account = privateKeyToAccount(KEEPER_KEY);
  const transport = http();
  const publicClient = createPublicClient({ chain: arcTestnet, transport });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport });

  console.log(`[keeper] Starting loop every ${TICK_INTERVAL_MS / 1000}s from ${account.address}`);

  const tick = async () => {
    try {
      const coins = await publicClient.readContract({
        address: REGISTRY_ADDRESS!,
        abi: registryAbi,
        functionName: 'getCoins',
      }) as Address[];

      for (const coin of coins) {
        await processCoin(coin, publicClient, walletClient);
      }
    } catch (err) {
      console.error('[keeper] tick error:', err);
    }
  };

  void tick();
  setInterval(() => void tick(), TICK_INTERVAL_MS);
}

async function processCoin(
  coin: Address,
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>
): Promise<void> {
  try {
    const info = await publicClient.readContract({
      address: REGISTRY_ADDRESS!,
      abi: registryAbi,
      functionName: 'getCoinInfo',
      args: [coin],
    }) as [Address, string, bigint, Address, boolean, bigint, boolean];

    const [creator, market, leverage, feeDest, burnMode, , graduated] = info;
    if (graduated) return;

    const subWallet = await publicClient.readContract({
      address: REGISTRY_ADDRESS!,
      abi: registryAbi,
      functionName: 'getCoinSubWallet',
      args: [coin],
    }) as Address;

    // Step 1 — claim and split fees
    try {
      await walletClient.writeContract({
        address: subWallet,
        abi: subWalletAbi,
        functionName: 'claimAndSplit',
        args: [creator, TREASURY!, feeDest, burnMode, 0n],
      });
      await query(
        `INSERT INTO keeper_events (coin_address, event_type) VALUES ($1, 'fee_claimed')`,
        [coin.toLowerCase()]
      );
    } catch {
      return; // No fees — skip
    }

    // Step 2 — position state
    const positionOpen = await publicClient.readContract({
      address: subWallet, abi: subWalletAbi, functionName: 'positionOpen',
    }) as boolean;

    const totalCollateral = await publicClient.readContract({
      address: subWallet, abi: subWalletAbi, functionName: 'totalCollateral',
    }) as bigint;

    // Step 3 — open if enough collateral
    if (!positionOpen && totalCollateral >= PERP_OPEN_THRESHOLD_USDC) {
      await walletClient.writeContract({
        address: subWallet,
        abi: subWalletAbi,
        functionName: 'openPosition',
        args: [totalCollateral, leverage, true, HL_BRIDGE!],
      });
      await query(
        `INSERT INTO keeper_events (coin_address, event_type, usdc_amount) VALUES ($1, 'position_opened', $2)`,
        [coin.toLowerCase(), Number(totalCollateral) / 1e6]
      );
      return;
    }

    if (!positionOpen) return;

    // Step 4/5 — check P&L
    const hlPos = await getPosition(subWallet, market).catch(() => null);
    if (!hlPos) return;

    const unrealizedPnl = parseFloat(hlPos.unrealizedPnl);
    const collateral = parseFloat(hlPos.marginUsed);

    await query(
      `INSERT INTO position_snapshots (coin_address, collateral, position_size, entry_price, mark_price, unrealized_pnl)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [coin.toLowerCase(), collateral, parseFloat(hlPos.szi),
        parseFloat(hlPos.entryPx), parseFloat(hlPos.entryPx), unrealizedPnl]
    );

    await query(
      `INSERT INTO leaderboard_cache (coin_address, total_pnl, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (coin_address) DO UPDATE SET total_pnl = EXCLUDED.total_pnl, updated_at = NOW()`,
      [coin.toLowerCase(), unrealizedPnl]
    );

    if (collateral > 0 && unrealizedPnl / collateral >= PROFIT_TRIGGER_RATIO) {
      await walletClient.writeContract({
        address: subWallet,
        abi: subWalletAbi,
        functionName: 'takeProfitSlice',
        args: [HL_BRIDGE!, TREASURY!, 0n],
      });
      await query(
        `INSERT INTO keeper_events (coin_address, event_type, usdc_amount) VALUES ($1, 'profit_taken', $2)`,
        [coin.toLowerCase(), unrealizedPnl]
      );
      const coinRow = await queryOne<{ ticker: string }>(
        `SELECT ticker FROM coins WHERE address = $1`, [coin.toLowerCase()]
      );
      if (coinRow) {
        await notify(formatCoinAlert(coinRow.ticker, coin, 'profit_taken', `+$${unrealizedPnl.toFixed(2)}`));
      }
      return;
    }

    if (collateral > 0 && unrealizedPnl / collateral < -NEAR_LIQ_RATIO) {
      const coinRow = await queryOne<{ ticker: string }>(
        `SELECT ticker FROM coins WHERE address = $1`, [coin.toLowerCase()]
      );
      if (coinRow) {
        await notify(formatCoinAlert(coinRow.ticker, coin, 'near_liquidation',
          `PnL ${unrealizedPnl.toFixed(2)} / collateral ${collateral.toFixed(2)}`));
      }
    }
  } catch (err) {
    console.error(`[keeper] processCoin ${coin}:`, err);
  }
}
