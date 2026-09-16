import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type LeaderboardEntry } from '../api';
import { Footer } from '../components/Footer';

type SortKey = 'pnl' | 'burned' | 'fees';

const MEDALS = ['🥇', '🥈', '🥉'];

export function Leaderboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [sort, setSort] = useState<SortKey>('pnl');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    void api.leaderboard(sort).then(({ leaderboard }) => {
      setRows(leaderboard);
      setLoaded(true);
    });
  }, [sort]);

  const loading = !loaded;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-20 px-5 py-3 border-b flex items-center justify-between"
        style={{
          background: 'rgba(8,15,28,0.82)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderColor: 'var(--border)',
        }}
      >
        <button
          onClick={() => { void navigate('/'); }}
          className="display font-bold text-2xl tracking-tight focus:outline-none"
        >
          <span className="text-glow" style={{ color: 'var(--accent)' }}>∞</span>
          <span style={{ color: 'var(--ink)' }}>.fun</span>
        </button>
        <button
          onClick={() => { void navigate('/launch'); }}
          className="px-4 py-1.5 text-xs font-bold rounded-xl btn-glow"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          + Launch
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10 relative z-10">
        <div className="fade-up">
          <h1 className="display text-4xl font-bold mb-1" style={{ color: 'var(--ink)' }}>Leaderboard</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--subtle)' }}>
            Top coins ranked by perp performance, supply burned, and fees generated.
          </p>
        </div>

        {/* Sort tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl mb-6 w-fit"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          {([
            { key: 'pnl' as SortKey, label: '📈 Total P&L', tip: 'Sort by total realized + unrealized perp P&L' },
            { key: 'burned' as SortKey, label: '🔥 Most burned', tip: 'Sort by total tokens removed from supply' },
            { key: 'fees' as SortKey, label: '💰 Most fees', tip: 'Sort by total USDC fees claimed from the curve' },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className="px-4 py-1.5 text-xs rounded-xl border transition-all"
              title={s.tip}
              style={{
                background: sort === s.key ? 'var(--surface-strong)' : 'transparent',
                borderColor: sort === s.key ? 'var(--border-mid)' : 'transparent',
                color: sort === s.key ? 'var(--ink)' : 'var(--muted)',
                fontWeight: sort === s.key ? 600 : 400,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div
            className="text-center py-16 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="text-4xl mb-3 opacity-40">∞</div>
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>No data yet. Launch a coin to get on the board.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r, idx) => {
              const sortVal = sort === 'burned'
                ? `${parseFloat(r.total_burned).toLocaleString(undefined, { maximumFractionDigits: 0 })} burned`
                : sort === 'fees'
                ? `$${parseFloat(r.total_fees_claimed).toFixed(2)} fees`
                : `$${parseFloat(r.total_pnl).toFixed(2)} P&L`;
              const valColor = sort === 'pnl' && parseFloat(r.total_pnl) < 0 ? 'var(--danger)' : 'var(--accent)';

              return (
                <button
                  key={r.address}
                  onClick={() => { void navigate(`/coin/${r.address}`); }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border text-left card-hover"
                  style={{
                    background: idx < 3 ? 'var(--surface-strong)' : 'var(--surface)',
                    borderColor: idx < 3 ? 'var(--border-mid)' : 'var(--border)',
                    boxShadow: idx === 0 ? 'var(--shadow-accent)' : 'var(--shadow-sm)',
                  }}
                >
                  {/* Rank */}
                  <span className="display font-bold text-sm w-7 text-center flex-shrink-0">
                    {idx < 3
                      ? <span>{MEDALS[idx]}</span>
                      : <span style={{ color: 'var(--subtle)' }}>{idx + 1}</span>
                    }
                  </span>

                  {/* Coin info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate" style={{ color: 'var(--ink)' }}>
                      ${r.ticker}
                      <span className="font-normal ml-1.5" style={{ color: 'var(--subtle)' }}>{r.name}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                      {r.market} · {r.leverage}× leverage
                    </div>
                  </div>

                  {/* Sort value */}
                  <div
                    className="text-sm font-bold mono flex-shrink-0"
                    style={{ color: valColor }}
                  >
                    {sortVal}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
