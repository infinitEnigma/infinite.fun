import express from 'express';
import cors from 'cors';
import path from 'path';
import { coinsRouter } from './routes/coins.js';
import { eventsRouter } from './routes/events.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { feedRouter } from './routes/feed.js';
import { uploadRouter } from './routes/upload.js';
import { analyticsRouter } from './routes/analytics.js';
import portfolioRouter from './routes/portfolio.js';
import pricesRouter from './routes/prices.js';
import { startKeeperLoop } from './keeper/tick.js';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

// Static image serving (in dev; nginx serves this in production)
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');
app.use('/images', express.static(UPLOAD_DIR));

// Routes
app.use('/api/coins', coinsRouter);
app.use('/api/coins', eventsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/feed', feedRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/prices', pricesRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.listen(PORT, () => {
  console.log(`[server] infinite.fun API listening on port ${PORT}`);
  startKeeperLoop();
});
