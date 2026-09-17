import { useEffect, useState } from 'react';
import { api, type LeaderboardEntry } from '../../api';
import { formatUnits } from 'viem';

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }
function usdcFmt(raw: string)  { return `$${Number(formatUnits(BigInt(raw), 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function tokenFmt(raw: string) { return Number(formatUnits(BigInt(raw), 18)).toLocaleString('en-US', { maximumFractionDigits: 0 }); }

export function CoinsPanel() {
  const [coins, setCoins]   = useState<LeaderboardEntry[]>([]);
  const [fetchCount, setFetchCount] = useState(0);
  const [sort, setSort]     = useState<'pnl' | 'burned' | 'fees'>('fees');

  useEffect(() => {
    setFetchCount(c => c + 1);
    api.leaderboard(sort, 100)
      .then(d => setCoins(d.leaderboard))
      .catch(console.error)
      .finally(() => setFetchCount(c => c - 1));
  }, [sort]);

  const loading = fetchCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {(['fees', 'pnl', 'burned'] as const).map(s => (
          <button key={s} onClick={() => setSort(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: sort === s ? 'var(--accent)' : 'var(--surface)',
              color:      sort === s ? '#0d1b2f'       : 'var(--muted)',
              border:     `1px solid ${sort === s ? 'transparent' : 'var(--border)'}`,
            }}>
            {s === 'fees' ? 'Top by fees' : s === 'pnl' ? 'Top by P&L' : 'Top by burned'}
          </button>
        ))}
        <span className="ml-auto text-xs self-center" style={{ color: 'var(--subtle)' }}>{coins.length} coins</span>
      </div>

      {loading ? (
        <div className="text-sm text-center py-12" style={{ color: 'var(--subtle)' }}>Loading…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)' }}>
                {['Coin', 'Market', 'Lev', 'Fees Claimed', 'Burned', 'P&L', 'Status'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coins.map((c, i) => (
                <tr key={c.address}
                  style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td className="px-4 py-3">
                    <div className="font-semibold" style={{ color: 'var(--ink)' }}>{c.ticker}</div>
                    <div className="mono text-xs" style={{ color: 'var(--subtle)' }}>{shortAddr(c.address)}</div>
                  </td>
                  <td className="px-4 py-3 mono text-xs" style={{ color: 'var(--muted)' }}>{c.market}</td>
                  <td className="px-4 py-3 mono text-xs" style={{ color: 'var(--muted)' }}>{c.leverage}×</td>
                  <td className="px-4 py-3 mono text-xs" style={{ color: 'var(--accent)' }}>{usdcFmt(c.total_fees_claimed)}</td>
                  <td className="px-4 py-3 mono text-xs" style={{ color: 'var(--success)' }}>{tokenFmt(c.total_burned)}</td>
                  <td className="px-4 py-3 mono text-xs"
                    style={{ color: Number(c.total_pnl) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {usdcFmt(c.total_pnl)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                      style={c.graduated_at
                        ? { background: 'rgba(172,198,233,0.15)', color: 'var(--accent-2)' }
                        : { background: 'rgba(74,222,128,0.10)', color: 'var(--success)' }}>
                      {c.graduated_at ? 'Graduated' : 'Live'}
                    </span>
                  </td>
                </tr>
              ))}
              {coins.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-sm" style={{ color: 'var(--subtle)' }}>No coins yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
