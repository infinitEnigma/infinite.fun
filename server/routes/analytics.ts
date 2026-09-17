import { Router } from 'express';
import { query } from '../db.js';

export const analyticsRouter = Router();

/**
 * GET /api/analytics?days=30
 * Returns time-series revenue, fee breakdown, coins-per-day, and summary totals.
 */
analyticsRouter.get('/', async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days ?? 30), 365);

    // Revenue time-series: daily USDC inflow by event_type
    const timeSeries = await query<{
      day: string; event_type: string; total_usdc: string;
    }>(`
      SELECT
        date_trunc('day', created_at)::date::text AS day,
        event_type,
        COALESCE(SUM(usdc_amount::numeric), 0)::text AS total_usdc
      FROM keeper_events
      WHERE created_at >= NOW() - ($1 || ' days')::interval
        AND usdc_amount IS NOT NULL
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `, [days]);

    // Lifetime totals per event_type
    const totals = await query<{
      event_type: string; total_usdc: string; event_count: string;
    }>(`
      SELECT
        event_type,
        COALESCE(SUM(usdc_amount::numeric), 0)::text AS total_usdc,
        COUNT(*)::text AS event_count
      FROM keeper_events
      GROUP BY event_type
      ORDER BY event_type
    `);

    // Coins launched per day
    const coinsPerDay = await query<{ day: string; count: string }>(`
      SELECT
        date_trunc('day', launched_at)::date::text AS day,
        COUNT(*)::text AS count
      FROM coins
      WHERE launched_at >= NOW() - ($1 || ' days')::interval
      GROUP BY 1
      ORDER BY 1 ASC
    `, [days]);

    // Cumulative summary
    const summary = await query<{
      total_coins: string; graduated_coins: string;
      total_fees_usdc: string; total_burned_tokens: string;
    }>(`
      SELECT
        COUNT(*)::text                                                                           AS total_coins,
        COUNT(CASE WHEN graduated_at IS NOT NULL THEN 1 END)::text                              AS graduated_coins,
        COALESCE((SELECT SUM(total_fees_claimed::numeric) FROM leaderboard_cache), 0)::text     AS total_fees_usdc,
        COALESCE((SELECT SUM(total_burned::numeric)       FROM leaderboard_cache), 0)::text     AS total_burned_tokens
      FROM coins
    `);

    res.json({ days, timeSeries, totals, coinsPerDay, summary: summary[0] ?? null });
  } catch (err) {
    console.error('[analytics] error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
