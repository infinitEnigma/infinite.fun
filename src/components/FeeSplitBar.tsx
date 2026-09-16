import { Tooltip } from './Tooltip';

interface Props {
  totalFeesUsdc: number;
}

const SPLITS = [
  {
    label: 'Perp margin',
    pct: 50,
    color: 'var(--accent)',
    tip: '50% of every fee claim funds the Hyperliquid perpetual position collateral.',
  },
  {
    label: 'Creator',
    pct: 15,
    color: '#7dd3fc',
    tip: '15% goes to the wallet address the creator specified at launch.',
  },
  {
    label: 'Treasury',
    pct: 20,
    color: 'var(--muted)',
    tip: '20% goes to the protocol treasury address.',
  },
  {
    label: 'Buyback & burn',
    pct: 15,
    color: 'var(--success)',
    tip: '15% is used to buy tokens on the bonding curve and burn them, reducing supply.',
  },
];

export function FeeSplitBar({ totalFeesUsdc }: Props) {
  return (
    <div>
      <h3 className="display text-sm font-semibold mb-3" style={{ color: 'var(--ink-2)' }}>
        Fee split
      </h3>

      {/* Segmented bar */}
      <div className="flex h-3 rounded-full overflow-hidden gap-px mb-4" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.4)' }}>
        {SPLITS.map((s) => (
          <Tooltip key={s.label} text={s.tip}>
            <div
              style={{ width: `${s.pct}%`, background: s.color, cursor: 'help' }}
              className="h-full transition-opacity hover:opacity-80"
            />
          </Tooltip>
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {SPLITS.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
              <Tooltip text={s.tip}>
                <span
                  className="underline decoration-dotted underline-offset-2 cursor-help"
                  style={{ color: 'var(--subtle)' }}
                >
                  {s.label}
                </span>
              </Tooltip>
            </div>
            <div className="text-right">
              <span className="mono font-semibold" style={{ color: 'var(--ink-2)' }}>{s.pct}%</span>
              {totalFeesUsdc > 0 && (
                <span className="mono ml-1.5" style={{ color: 'var(--subtle)' }}>
                  ${((totalFeesUsdc * s.pct) / 100).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalFeesUsdc > 0 && (
        <div
          className="mt-3 pt-3 flex justify-between text-xs"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--subtle)' }}
        >
          <span>Total fees claimed</span>
          <span className="mono font-semibold" style={{ color: 'var(--accent)' }}>
            ${totalFeesUsdc.toFixed(2)} USDC
          </span>
        </div>
      )}
    </div>
  );
}
