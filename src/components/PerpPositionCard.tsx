import { useEffect, useState } from 'react';
import { Tooltip } from './Tooltip';
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
      <div
        className="p-4 rounded-2xl border animate-pulse h-36"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      />
    );
  }

  if (!snapshot) {
    return (
      <div
        className="p-4 rounded-2xl border text-sm"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--subtle)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--subtle)', opacity: 0.5 }}
          />
          <span className="font-medium" style={{ color: 'var(--muted)' }}>Position pending</span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
          Opens automatically once $20 USDC of bonding curve fees have accrued.
          The keeper checks every 15 seconds.
        </p>
      </div>
    );
  }

  const pnl = parseFloat(snapshot.unrealized_pnl);
  const collateral = parseFloat(snapshot.collateral);
  const pnlPct = collateral > 0 ? (pnl / collateral) * 100 : 0;
  const isProfit = pnl >= 0;
  const nearTrigger = pnlPct >= 40;

  return (
    <div
      className="p-4 rounded-2xl border"
      style={{
        background: 'var(--surface)',
        borderColor: nearTrigger ? 'rgba(109,217,143,0.3)' : 'var(--border)',
        boxShadow: nearTrigger ? '0 0 20px rgba(109,217,143,0.08)' : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="display text-sm font-bold" style={{ color: 'var(--ink)' }}>
            {market}-USDC · LONG · {leverage}×
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }}
          />
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-md"
            style={{
              background: 'rgba(109,217,143,0.10)',
              color: 'var(--success)',
              border: '1px solid rgba(109,217,143,0.18)',
            }}
          >
            LIVE
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Stat label="Collateral" value={`$${parseFloat(snapshot.collateral).toFixed(2)}`} tip="USDC posted as margin on Hyperliquid" />
        <Stat label="Size" value={parseFloat(snapshot.position_size).toFixed(4)} tip="Notional position size in base asset units" />
        <Stat label="Entry price" value={`$${parseFloat(snapshot.entry_price).toFixed(2)}`} tip="Weighted average entry price" />
        <Stat label="Mark price" value={`$${parseFloat(snapshot.mark_price).toFixed(2)}`} tip="Current oracle mark price on Hyperliquid" />
      </div>

      {/* P&L highlight */}
      <div
        className="rounded-xl p-3 flex items-center justify-between"
        style={{
          background: isProfit
            ? 'rgba(109,217,143,0.07)'
            : 'rgba(240,107,120,0.07)',
          border: `1px solid ${isProfit ? 'rgba(109,217,143,0.15)' : 'rgba(240,107,120,0.15)'}`,
        }}
      >
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>Unrealized P&L</span>
        <div className="text-right">
          <span
            className="text-lg font-bold mono"
            style={{
              color: isProfit ? 'var(--success)' : 'var(--danger)',
              textShadow: isProfit ? '0 0 12px rgba(109,217,143,0.4)' : '0 0 12px rgba(240,107,120,0.4)',
            }}
          >
            {isProfit ? '+' : ''}${Math.abs(pnl).toFixed(2)}
          </span>
          <span className="text-sm ml-1.5 font-medium" style={{ color: isProfit ? 'var(--success)' : 'var(--danger)', opacity: 0.8 }}>
            ({isProfit ? '+' : ''}{pnlPct.toFixed(1)}%)
          </span>
        </div>
      </div>

      {/* Profit trigger alert */}
      {nearTrigger && (
        <div
          className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{ background: 'rgba(109,217,143,0.08)', border: '1px solid rgba(109,217,143,0.2)', color: 'var(--success)' }}
        >
          <span>⚡</span>
          <span>Approaching +50% trigger — keeper will take a 25% profit slice next tick</span>
        </div>
      )}

      {/* Last update */}
      <p className="text-xs mt-3" style={{ color: 'var(--subtle)', opacity: 0.6 }}>
        Updated {new Date(snapshot.snapshotted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · refreshes every 15s
      </p>
    </div>
  );
}

function Stat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div>
      <div className="text-xs mb-0.5">
        {tip ? (
          <Tooltip text={tip}>
            <span
              className="underline decoration-dotted underline-offset-2 cursor-help"
              style={{ color: 'var(--subtle)' }}
            >
              {label}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--subtle)' }}>{label}</span>
        )}
      </div>
      <div className="text-sm font-semibold mono" style={{ color: 'var(--ink-2)' }}>{value}</div>
    </div>
  );
}
