import { Router, type Request, type Response } from 'express';
import { query } from '../db.js';

export const leaderboardRouter = Router();

// GET /api/leaderboard?sort=pnl|burned|fees&limit=20
leaderboardRouter.get('/', async (req: Request, res: Response) => {
  const sort = (req.query.sort as string) ?? 'pnl';
  const limit = Math.min(Number(req.query.limit ?? 20), 100);

  const orderCol =
    sort === 'burned' ? 'lc.total_burned'
    : sort === 'fees'  ? 'lc.total_fees_claimed'
    : 'lc.total_pnl';

  const rows = await query(`
    SELECT c.address, c.name, c.ticker, c.image_url, c.market, c.leverage,
           lc.total_fees_claimed, lc.total_burned, lc.total_pnl, lc.updated_at
    FROM leaderboard_cache lc
    JOIN coins c ON c.address = lc.coin_address
    ORDER BY ${orderCol} DESC NULLS LAST
    LIMIT $1
  `, [limit]);

  res.json({ leaderboard: rows });
});
