import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { api, type FeedCoin } from '../api';
import { CoinCard } from '../components/CoinCard';

const MARKETS = ['All', 'BTC', 'ETH', 'SOL', 'HYPE', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'SPY'];

export function LaunchFeed() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<FeedCoin[]>([]);
  const [fetchCount, setFetchCount] = useState(0);
  const [market, setMarket] = useState('All');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (m: string, p: number, append: boolean) => {
    setFetchCount((n) => n + 1);
    try {
      const { coins: rows } = await api.feed({
        market: m === 'All' ? undefined : m,
        page: p,
      });
      setCoins((prev) => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === 20);
    } finally {
      setFetchCount((n) => n - 1);
    }
  }, []);

  useEffect(() => {
    void load(market, 1, false);
  }, [market, load]);

  // keep page in sync when market changes
  const handleMarketChange = (m: string) => {
    setPage(1);
    setMarket(m);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ background: 'rgba(13,27,47,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
      >
        <span className="display font-bold text-xl" style={{ color: 'var(--ink)' }}>infinite.fun</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void navigate('/leaderboard'); }}
            className="px-3 py-1.5 text-xs rounded-lg border transition-all hover:bg-[var(--surface-strong)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Leaderboard
          </button>
          <ConnectKitButton />
          <button
            onClick={() => { void navigate('/launch'); }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            + Launch coin
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8 text-center">
          <h1 className="display text-4xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
            Coins that own a position.
          </h1>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--subtle)' }}>
            Every coin is backed by a live leveraged perpetual. Trading fees fund the perp; profits burn supply. The position never closes.
          </p>
        </div>

        {/* Market filter */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => handleMarketChange(m)}
              className="px-3 py-1 text-xs rounded-full border transition-all"
              style={{
                background: market === m ? 'var(--accent)' : 'var(--surface)',
                borderColor: market === m ? 'var(--accent)' : 'var(--border)',
                color: market === m ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Grid */}
        {fetchCount > 0 && coins.length === 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({length: 6}).map((_, i) => (
              <div key={i} className="h-44 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : coins.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--subtle)' }}>
            <div className="text-4xl mb-3">∞</div>
            <p className="text-sm">No coins yet. Be the first to launch.</p>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {coins.map((c) => (
                <CoinCard key={c.address} coin={c} onClick={() => { void navigate(`/coin/${c.address}`); }} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    void load(market, next, true);
                  }}
                  className="px-6 py-2 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
