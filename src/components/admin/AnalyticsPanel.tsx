import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { api, type AnalyticsData } from '../../api';
import { formatUnits } from 'viem';

const EVENT_COLORS: Record<string, string> = {
  fee_claimed:    '#acc6e9',
  profit_taken:   '#86efac',
  margin_added:   '#7dd3fc',
  buyback_burned: '#c4b5fd',
  graduated:      '#fbbf24',
};

const EVENT_LABELS: Record<string, string> = {
  fee_claimed:    'Fee claims',
  profit_taken:   'Profit takes',
  margin_added:   'Margin added',
  buyback_burned: 'Buyback burns',
  graduated:      'Graduations',
};

function usdcNum(raw: string) { return Number(formatUnits(BigInt(raw), 6)); }

export function AnalyticsPanel() {
  const [data, setData]   = useState<AnalyticsData | null>(null);
  const [days, setDays]   = useState(30);
  const [fetchCount, setFetchCount] = useState(0);

  useEffect(() => {
    setFetchCount(c => c + 1);
    api.analytics(days)
      .then(setData)
      .catch(console.error)
      .finally(() => setFetchCount(c => c - 1));
  }, [days]);

  const loading = fetchCount > 0;

  if (loading || !data) {
    return <div className="text-sm text-center py-16" style={{ color: 'var(--subtle)' }}>Loading analytics…</div>;
  }

  // Build per-day revenue object
  const dayMap: Record<string, Record<string, number>> = {};
  for (const row of data.timeSeries) {
    if (!dayMap[row.day]) dayMap[row.day] = {};
    dayMap[row.day][row.event_type] = usdcNum(row.total_usdc);
  }
  const revenueChart = Object.entries(dayMap).map(([day, vals]) => ({ day, ...vals }));

  const breakdownChart = data.totals.map(t => ({
    name:  EVENT_LABELS[t.event_type] ?? t.event_type,
    usdc:  usdcNum(t.total_usdc),
    count: Number(t.event_count),
  }));

  const coinsChart = data.coinsPerDay.map(r => ({ day: r.day, coins: Number(r.count) }));
  const s          = data.summary;

  return (
    <div className="space-y-8">
      {/* Summary */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Coins',   value: Number(s.total_coins).toLocaleString() },
            { label: 'Graduated',     value: Number(s.graduated_coins).toLocaleString() },
            { label: 'Total Revenue', value: `$${usdcNum(s.total_fees_usdc).toFixed(2)}` },
            { label: 'Tokens Burned', value: Number(formatUnits(BigInt(s.total_burned_tokens), 18)).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>{label}</div>
              <div className="text-xl font-bold display" style={{ color: 'var(--ink)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Range selector */}
      <div className="flex gap-2">
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: days === d ? 'var(--accent)' : 'var(--surface)',
              color:      days === d ? '#0d1b2f'       : 'var(--muted)',
              border:     `1px solid ${days === d ? 'transparent' : 'var(--border)'}`,
            }}>
            {d}d
          </button>
        ))}
      </div>

      {/* Revenue area chart */}
      <div>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-2)' }}>Revenue Over Time (USDC)</div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {revenueChart.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--subtle)' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChart}>
                <defs>
                  {Object.entries(EVENT_COLORS).map(([key, color]) => (
                    <linearGradient key={key} id={`g-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day"  tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} />
                <YAxis               tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown, name: unknown) => [`$${(v as number).toFixed(4)}`, EVENT_LABELS[name as string] ?? (name as string)]} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(EVENT_COLORS).map(key => (
                  <Area key={key} type="monotone" dataKey={key} name={key}
                    stroke={EVENT_COLORS[key]} fill={`url(#g-${key})`} strokeWidth={1.5} dot={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Fee breakdown */}
      <div>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-2)' }}>Fee Source Breakdown (lifetime)</div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {breakdownChart.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--subtle)' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={breakdownChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => [`$${(v as number).toFixed(4)}`, 'USDC']} />
                <Bar dataKey="usdc" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Coins per day */}
      <div>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-2)' }}>Coins Launched Per Day</div>
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {coinsChart.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: 'var(--subtle)' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={coinsChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day"  tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface-strong)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="coins" fill="var(--accent-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
