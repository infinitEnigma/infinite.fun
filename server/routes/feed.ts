import { Router, type Request, type Response } from 'express';
import { query } from '../db.js';

export const feedRouter = Router();

// GET /api/feed?page=1&limit=20&market=BTC&graduated=false
feedRouter.get('/', async (req: Request, res: Response) => {
  const page = Math.max(Number(req.query.page ?? 1), 1);
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const offset = (page - 1) * limit;
  const market = req.query.market as string | undefined;
  const graduated = req.query.graduated;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (market) {
    params.push(market);
    conditions.push(`c.market = $${params.length}`);
  }
  if (graduated === 'false') conditions.push('c.graduated_at IS NULL');
  if (graduated === 'true') conditions.push('c.graduated_at IS NOT NULL');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(`
    SELECT
      c.*,
      lc.total_fees_claimed,
      lc.total_burned,
      lc.total_pnl,
      ps.unrealized_pnl   AS latest_pnl,
      ps.collateral        AS latest_collateral,
      ps.mark_price        AS latest_mark_price,
      ps.snapshotted_at    AS latest_snapshot_at
    FROM coins c
    LEFT JOIN leaderboard_cache lc ON c.address = lc.coin_address
    LEFT JOIN LATERAL (
      SELECT * FROM position_snapshots
      WHERE coin_address = c.address
      ORDER BY snapshotted_at DESC
      LIMIT 1
    ) ps ON true
    ${where}
    ORDER BY c.launched_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);

  res.json({ coins: rows, page, limit });
});
