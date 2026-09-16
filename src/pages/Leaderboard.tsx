import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type LeaderboardEntry } from '../api';

type SortKey = 'pnl' | 'burned' | 'fees';

export function Leaderboard() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [sort, setSort] = useState<SortKey>('pnl');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api.leaderboard(sort).then(({ leaderboard }) => {
      setRows(leaderboard);
      setLoaded(true);
    });
  }, [sort]);

  const loading = !loaded;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      <nav
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ background: 'rgba(13,27,47,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
      >
        <button onClick={() => { void navigate('/'); }} className="display font-bold text-xl" style={{ color: 'var(--ink)' }}>
          ← infinite.fun
        </button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="display text-3xl font-bold mb-6" style={{ color: 'var(--ink)' }}>Leaderboard</h1>

        {/* Sort tabs */}
        <div className="flex gap-1.5 mb-6">
          {([
            { key: 'pnl' as SortKey, label: 'Total P&L' },
            { key: 'burned' as SortKey, label: 'Most burned' },
            { key: 'fees' as SortKey, label: 'Most fees' },
          ]).map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className="px-3 py-1 text-xs rounded-full border transition-all"
              style={{
                background: sort === s.key ? 'var(--accent)' : 'var(--surface)',
                borderColor: sort === s.key ? 'var(--accent)' : 'var(--border)',
                color: sort === s.key ? 'var(--bg)' : 'var(--muted)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({length: 10}).map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>No data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, idx) => (
              <button
                key={r.address}
                onClick={() => { void navigate(`/coin/${r.address}`); }}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-all hover:bg-[var(--surface-strong)]"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <span
                  className="display font-bold text-sm w-6 text-center flex-shrink-0"
                  style={{ color: idx < 3 ? 'var(--accent)' : 'var(--subtle)' }}
                >
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>
                    ${r.ticker} · {r.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--subtle)' }}>{r.market} {r.leverage}×</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold mono" style={{ color: 'var(--accent)' }}>
                    {sort === 'burned'
                      ? `${parseFloat(r.total_burned).toLocaleString(undefined, { maximumFractionDigits: 0 })} burned`
                      : sort === 'fees'
                      ? `$${parseFloat(r.total_fees_claimed).toFixed(2)} fees`
                      : `$${parseFloat(r.total_pnl).toFixed(2)} P&L`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
