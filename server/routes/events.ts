import { Router, type Request, type Response } from 'express';
import { query } from '../db.js';

export const eventsRouter = Router();

// GET /api/coins/:address/events?limit=50&offset=0
eventsRouter.get('/:address/events', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const events = await query(`
    SELECT * FROM keeper_events
    WHERE coin_address = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `, [req.params.address.toLowerCase(), limit, offset]);

  res.json({ events });
});

// GET /api/coins/:address/snapshots?limit=100
eventsRouter.get('/:address/snapshots', async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 1000);

  const snapshots = await query(`
    SELECT * FROM position_snapshots
    WHERE coin_address = $1
    ORDER BY snapshotted_at ASC
    LIMIT $2
  `, [req.params.address.toLowerCase(), limit]);

  res.json({ snapshots });
});
