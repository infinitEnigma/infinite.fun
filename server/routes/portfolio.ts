import { Router } from 'express';
import { query } from '../db';

const router = Router();

/**
 * GET /api/portfolio/:address
 *
 * Returns the full portfolio for a wallet address:
 * - Coins created by this address
 * - Keeper events attributed to this address (buy/sell recorded at launch)
 * - Aggregate stats: total launched, total fees earned as creator, total tokens burned via buyback
 * - Leaderboard rank for each created coin
 */
router.get('/:address', async (req, res) => {
  const { address } = req.params;
  const addr = address.toLowerCase();

  try {
    // Coins created by this wallet
    const coinsResult = await query<{
      address: string; name: string; ticker: string; description: string | null;
      image_url: string | null; market: string; leverage: number; burn_mode: boolean;
      launched_at: string; graduated_at: string | null; graduation_pool: string | null;
      sub_wallet: string; curve: string;
      total_fees_claimed: string | null; total_burned: string | null; total_pnl: string | null;
      latest_pnl: string | null; latest_collateral: string | null; latest_mark_price: string | null;
      latest_snapshot_at: string | null;
    }>(
      `SELECT
         c.address, c.name, c.ticker, c.description, c.image_url,
         c.market, c.leverage, c.burn_mode,
         c.launched_at, c.graduated_at, c.graduation_pool,
         c.sub_wallet, c.curve,
         lc.total_fees_claimed, lc.total_burned, lc.total_pnl,
         ps.unrealized_pnl      AS latest_pnl,
         ps.collateral          AS latest_collateral,
         ps.mark_price          AS latest_mark_price,
         ps.snapshotted_at      AS latest_snapshot_at
       FROM coins c
       LEFT JOIN leaderboard_cache lc ON lc.coin_address = c.address
       LEFT JOIN LATERAL (
         SELECT unrealized_pnl, collateral, mark_price, snapshotted_at
         FROM position_snapshots
         WHERE coin_address = c.address
         ORDER BY snapshotted_at DESC
         LIMIT 1
       ) ps ON TRUE
       WHERE LOWER(c.creator) = $1
       ORDER BY c.launched_at DESC`,
      [addr]
    );

    // Per-coin keeper event history for created coins
    const coinAddresses = coinsResult.map(c => c.address);

    let events: {
      id: number; coin_address: string; event_type: string;
      usdc_amount: string | null; tokens_amount: string | null;
      tx_hash: string | null; block_number: number | null; created_at: string;
    }[] = [];

    if (coinAddresses.length > 0) {
      events = await query(
        `SELECT id, coin_address, event_type, usdc_amount, tokens_amount,
                tx_hash, block_number, created_at
         FROM keeper_events
         WHERE coin_address = ANY($1)
         ORDER BY created_at DESC
         LIMIT 200`,
        [coinAddresses]
      );
    }

    // Aggregate stats across all created coins
    const statsResult = await query<{
      coin_count: string;
      graduated_count: string;
      total_creator_fees: string;
      total_burned: string;
      total_pnl: string;
    }>(
      `SELECT
         COUNT(c.address)::text                                       AS coin_count,
         COUNT(c.graduated_at)::text                                  AS graduated_count,
         COALESCE(SUM(lc.total_fees_claimed::numeric * 0.15), 0)::text AS total_creator_fees,
         COALESCE(SUM(lc.total_burned::numeric), 0)::text            AS total_burned,
         COALESCE(SUM(lc.total_pnl::numeric), 0)::text               AS total_pnl
       FROM coins c
       LEFT JOIN leaderboard_cache lc ON lc.coin_address = c.address
       WHERE LOWER(c.creator) = $1`,
      [addr]
    );

    // Revenue over time for this creator (creator slice = 15% of fee_claimed events)
    const revenueHistory = await query<{ day: string; creator_fees: string }>(
      `SELECT
         DATE_TRUNC('day', ke.created_at)::date::text AS day,
         SUM(ke.usdc_amount::numeric * 0.15)::text    AS creator_fees
       FROM keeper_events ke
       JOIN coins c ON c.address = ke.coin_address
       WHERE LOWER(c.creator) = $1
         AND ke.event_type = 'fee_claimed'
         AND ke.usdc_amount IS NOT NULL
       GROUP BY 1
       ORDER BY 1 ASC`,
      [addr]
    );

    // Position snapshots for all created coins (last 100 per coin for sparklines)
    let snapshots: {
      coin_address: string; collateral: string; unrealized_pnl: string;
      mark_price: string; snapshotted_at: string;
    }[] = [];

    if (coinAddresses.length > 0) {
      snapshots = await query(
        `SELECT coin_address, collateral, unrealized_pnl, mark_price, snapshotted_at
         FROM position_snapshots
         WHERE coin_address = ANY($1)
         ORDER BY snapshotted_at DESC
         LIMIT ${coinAddresses.length * 100}`,
        [coinAddresses]
      );
    }

    res.json({
      address,
      coins: coinsResult,
      events,
      snapshots,
      stats: statsResult[0] ?? {
        coin_count: '0',
        graduated_count: '0',
        total_creator_fees: '0',
        total_burned: '0',
        total_pnl: '0',
      },
      revenueHistory,
    });
  } catch (err) {
    console.error('[portfolio]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
