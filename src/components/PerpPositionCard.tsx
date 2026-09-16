import { useEffect, useState } from 'react';
import { api, type PositionSnapshot } from '../api';

interface Props {
  coinAddress: string;
  market: string;
  leverage: number;
}

export function PerpPositionCard({ coinAddress, market, leverage }: Props) {
  const [snapshot, setSnapshot] = useState<PositionSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { snapshots } = await api.getSnapshots(coinAddress, 1);
        if (!cancelled) setSnapshot(snapshots[0] ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [coinAddress]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border animate-pulse h-32" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />
    );
  }

  if (!snapshot) {
    return (
      <div className="p-4 rounded-xl border text-sm" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--subtle)' }}>
        Position not yet open. Opens once $20 of fees have accrued.
      </div>
    );
  }

  const pnl = parseFloat(snapshot.unrealized_pnl);
  const collateral = parseFloat(snapshot.collateral);
  const pnlPct = collateral > 0 ? (pnl / collateral) * 100 : 0;
  const isProfit = pnl >= 0;

  return (
    <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold display" style={{ color: 'var(--ink)' }}>
          {market} · LONG · {leverage}×
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}
        >
          LIVE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Collateral" value={`$${parseFloat(snapshot.collateral).toFixed(2)}`} />
        <Stat label="Size" value={parseFloat(snapshot.position_size).toFixed(4)} />
        <Stat label="Entry price" value={`$${parseFloat(snapshot.entry_price).toFixed(2)}`} />
        <Stat label="Mark price" value={`$${parseFloat(snapshot.mark_price).toFixed(2)}`} />
        <div className="col-span-2">
          <div className="text-xs mb-0.5" style={{ color: 'var(--subtle)' }}>Unrealized P&L</div>
          <div
            className="text-lg font-bold mono"
            style={{ color: isProfit ? 'var(--success)' : 'var(--danger)' }}
          >
            {isProfit ? '+' : ''}${Math.abs(pnl).toFixed(2)}
            <span className="text-sm ml-1.5 font-normal">
              ({isProfit ? '+' : ''}{pnlPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Profit trigger indicator */}
      {pnlPct >= 40 && (
        <div className="mt-3 text-xs px-2 py-1 rounded" style={{ background: '#1a4a2e', color: 'var(--success)' }}>
          Approaching +50% profit trigger — next keeper tick will take 25% slice
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: 'var(--subtle)' }}>{label}</div>
      <div className="text-sm font-semibold mono" style={{ color: 'var(--ink-2)' }}>{value}</div>
    </div>
  );
}
