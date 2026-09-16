interface Props {
  totalFeesUsdc: number; // total historical fees in USDC
}

const SPLITS = [
  { label: 'Perp margin', pct: 50, color: 'var(--accent)' },
  { label: 'Creator', pct: 15, color: '#7dd3fc' },
  { label: 'Treasury', pct: 20, color: 'var(--subtle)' },
  { label: 'Buyback & burn', pct: 15, color: 'var(--success)' },
];

export function FeeSplitBar({ totalFeesUsdc }: Props) {
  return (
    <div>
      {/* Bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
        {SPLITS.map((s) => (
          <div key={s.label} style={{ width: `${s.pct}%`, background: s.color }} />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {SPLITS.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
              <span style={{ color: 'var(--subtle)' }}>{s.label}</span>
            </div>
            <span className="mono font-medium" style={{ color: 'var(--ink-2)' }}>
              {s.pct}% · ${((totalFeesUsdc * s.pct) / 100).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
