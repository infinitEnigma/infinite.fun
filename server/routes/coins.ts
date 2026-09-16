import { Router, type Request, type Response } from 'express';
import { query, queryOne } from '../db.js';

export const coinsRouter = Router();

// GET /api/coins
coinsRouter.get('/', async (_req: Request, res: Response) => {
  const coins = await query(`
    SELECT c.*, lc.total_fees_claimed, lc.total_burned, lc.total_pnl
    FROM coins c
    LEFT JOIN leaderboard_cache lc ON c.address = lc.coin_address
    ORDER BY c.launched_at DESC
  `);
  res.json({ coins });
});

// GET /api/coins/:address
coinsRouter.get('/:address', async (req: Request, res: Response) => {
  const coin = await queryOne(`
    SELECT c.*, lc.total_fees_claimed, lc.total_burned, lc.total_pnl
    FROM coins c
    LEFT JOIN leaderboard_cache lc ON c.address = lc.coin_address
    WHERE c.address = $1
  `, [req.params.address.toLowerCase()]);

  if (!coin) return res.status(404).json({ error: 'Coin not found' });
  res.json({ coin });
});

// POST /api/coins — called by frontend at launch time to store metadata
coinsRouter.post('/', async (req: Request, res: Response) => {
  const { address, name, ticker, description, imageUrl, creator, market, leverage, feeDest, burnMode, subWallet, curve } = req.body as {
    address: string; name: string; ticker: string; description?: string;
    imageUrl?: string; creator: string; market: string; leverage: number;
    feeDest: string; burnMode: boolean; subWallet: string; curve: string;
  };

  if (!address || !name || !ticker || !creator || !market || !subWallet || !curve) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  await query(`
    INSERT INTO coins (address, name, ticker, description, image_url, creator, market, leverage, fee_dest, burn_mode, sub_wallet, curve)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (address) DO NOTHING
  `, [
    address.toLowerCase(), name, ticker, description ?? null, imageUrl ?? null,
    creator.toLowerCase(), market, leverage, feeDest.toLowerCase(),
    burnMode, subWallet.toLowerCase(), curve.toLowerCase(),
  ]);

  // Seed leaderboard cache row
  await query(`
    INSERT INTO leaderboard_cache (coin_address) VALUES ($1) ON CONFLICT DO NOTHING
  `, [address.toLowerCase()]);

  res.status(201).json({ ok: true });
});
