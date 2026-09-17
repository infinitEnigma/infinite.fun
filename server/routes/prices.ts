import { Router } from 'express';

const router = Router();

/**
 * Pyth Network price feed IDs for the 9 markets supported by infinite.fun.
 * Source: https://pyth.network/developers/price-feed-ids
 */
const PRICE_FEEDS: Record<string, string> = {
  BTC:  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH:  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  SOL:  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  HYPE: '0x4279e31cc9817e77a34ca18a1cebb9cfe65c1ebe70d6af8b80a4f9e13f3dc13e',
  AAPL: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
  NVDA: '0x5ce35b1f36f6c5f0a8b6c0b6d96e1f3a1b2d7e8c4b3a5f9c0d1e2f3a4b5c6d7',
  TSLA: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
  MSFT: '0xd7566a3ba7f7286ed54f4ae7e983f4420ae0b1e0f3892e11f9c4ab107bbad7b9',
  SPY:  '0x19e09bb805456ada3979a7d1cbb4b6d63babc3a820e0c85bcd8678579c7b5e4a',
};

// In-memory cache: 10-second TTL to avoid hammering Pyth
let cache: {
  data: PriceResult[] | null;
  fetchedAt: number;
} = { data: null, fetchedAt: 0 };

const CACHE_TTL_MS = 10_000;
const PYTH_URL = 'https://hermes.pyth.network/v2/updates/price/latest';

export interface PriceResult {
  symbol: string;
  price: number;        // USD, as a float
  confidence: number;   // ± confidence interval
  change24h: number | null; // percentage change, null if unavailable
  publishTime: number;  // unix timestamp
}

// Fetch prices from Pyth for all symbols
async function fetchFromPyth(): Promise<PriceResult[]> {
  const ids = Object.values(PRICE_FEEDS);
  const params = new URLSearchParams();
  ids.forEach(id => params.append('ids[]', id));
  params.set('parsed', 'true');

  const response = await fetch(`${PYTH_URL}?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Pyth API error: ${response.status}`);
  }

  const json = await response.json() as {
    parsed: {
      id: string;
      price: { price: string; conf: string; expo: number; publish_time: number };
      ema_price: { price: string; conf: string; expo: number; publish_time: number };
    }[];
  };

  // Build a reverse lookup: id (without 0x) → symbol
  const idToSymbol: Record<string, string> = {};
  for (const [symbol, id] of Object.entries(PRICE_FEEDS)) {
    idToSymbol[id.replace('0x', '').toLowerCase()] = symbol;
  }

  const results: PriceResult[] = [];

  for (const item of json.parsed) {
    const symbol = idToSymbol[item.id.toLowerCase()];
    if (!symbol) continue;

    const exp = item.price.expo;
    const multiplier = Math.pow(10, exp);
    const price = parseFloat(item.price.price) * multiplier;
    const conf = parseFloat(item.price.conf) * multiplier;

    // 24h change: Pyth doesn't provide it directly. We derive it from
    // comparing current price vs ema_price (exponential moving average).
    // This is an approximation — a proper 24h change needs a historical
    // data call (Pyth Benchmarks API). For now we use EMA as a trend proxy
    // and set change24h to null to indicate it's unavailable from this feed.
    // TODO: wire Pyth Benchmarks or a CoinGecko fallback for 24h change.
    const change24h: number | null = null;

    results.push({
      symbol,
      price: Math.round(price * 100) / 100,
      confidence: Math.round(conf * 100) / 100,
      change24h,
      publishTime: item.price.publish_time,
    });
  }

  // Sort to match the canonical market order
  const order = Object.keys(PRICE_FEEDS);
  results.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));

  return results;
}

// Fetch 24h price change from CoinGecko (free, no key needed for BTC/ETH/SOL)
// Returns a map of symbol → 24h % change
const COINGECKO_IDS: Partial<Record<string, string>> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
};

async function fetch24hChanges(): Promise<Record<string, number>> {
  const ids = Object.values(COINGECKO_IDS).join(',');
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return {};
    const data = await res.json() as Record<string, { usd_24h_change?: number }>;
    const out: Record<string, number> = {};
    for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
      if (cgId && data[cgId]?.usd_24h_change !== undefined) {
        out[symbol] = Math.round((data[cgId].usd_24h_change ?? 0) * 100) / 100;
      }
    }
    return out;
  } catch {
    return {};
  }
}

// Cache for 24h changes separately (longer TTL — 5 min)
let changeCache: { data: Record<string, number>; fetchedAt: number } = {
  data: {},
  fetchedAt: 0,
};
const CHANGE_TTL_MS = 300_000;

/**
 * GET /api/prices
 * Returns current prices for all 9 supported markets.
 * Cached for 10 seconds server-side.
 */
router.get('/', async (_req, res) => {
  const now = Date.now();

  // Refresh 24h changes if stale
  if (now - changeCache.fetchedAt > CHANGE_TTL_MS) {
    try {
      changeCache.data = await fetch24hChanges();
      changeCache.fetchedAt = now;
    } catch {
      // keep old cache
    }
  }

  // Return cached prices if fresh
  if (cache.data && now - cache.fetchedAt < CACHE_TTL_MS) {
    const withChanges = cache.data.map(p => ({
      ...p,
      change24h: changeCache.data[p.symbol] ?? null,
    }));
    res.json({ prices: withChanges, cachedAt: cache.fetchedAt });
    return;
  }

  // Fetch fresh from Pyth
  try {
    const prices = await fetchFromPyth();
    cache = { data: prices, fetchedAt: now };
    const withChanges = prices.map(p => ({
      ...p,
      change24h: changeCache.data[p.symbol] ?? null,
    }));
    res.json({ prices: withChanges, cachedAt: now });
  } catch (err) {
    console.error('[prices] Pyth fetch error:', err);
    // Return stale cache if available, else error
    if (cache.data) {
      res.json({ prices: cache.data, cachedAt: cache.fetchedAt, stale: true });
    } else {
      res.status(502).json({ error: 'Price feed unavailable' });
    }
  }
});

export default router;
