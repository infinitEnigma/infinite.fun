import { Tooltip } from './Tooltip';
import type { FeedCoin } from '../api';

const MARKET_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', SOL: '◎', HYPE: '⚡',
  AAPL: '', NVDA: '', TSLA: '', MSFT: '', SPY: '📊',
};

interface Props {
  coin: FeedCoin;
  onClick: () => void;
}

const GRAD_THRESHOLD = 420; // USDC

function timeSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function CoinCard({ coin, onClick }: Props) {
  const feesUsd = parseFloat(coin.total_fees_claimed ?? '0');
  const pnl = parseFloat(coin.latest_pnl ?? '0');
  const collateral = parseFloat(coin.latest_collateral ?? '0');
  const progress = Math.min((feesUsd / GRAD_THRESHOLD) * 100, 100);
  const pnlPct = collateral > 0 ? (pnl / collateral) * 100 : 0;
  const isGraduated = !!coin.graduated_at;
  const hasPnl = collateral > 0;
  const isProfit = pnl >= 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border card-hover focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          {coin.image_url ? (
            <img
              src={coin.image_url} alt={coin.ticker}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
              style={{ boxShadow: '0 0 0 2px var(--border-mid)' }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--surface-strong), var(--surface-muted))',
                color: 'var(--accent)',
                boxShadow: '0 0 0 2px var(--border-mid)',
              }}
            >
              {coin.ticker.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-bold text-sm display" style={{ color: 'var(--ink)' }}>
              ${coin.ticker}
            </div>
            <div className="text-xs truncate max-w-[120px]" style={{ color: 'var(--subtle)' }}>
              {coin.name}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <Tooltip text={`Perp market: ${coin.market} at ${coin.leverage}× leverage`}>
            <span
              className="text-xs px-2 py-0.5 rounded-md font-mono font-medium"
              style={{
                background: 'rgba(122,173,223,0.10)',
                color: 'var(--accent)',
                border: '1px solid rgba(122,173,223,0.18)',
              }}
            >
              {MARKET_ICONS[coin.market] ?? ''} {coin.market} {coin.leverage}×
            </span>
          </Tooltip>
          {isGraduated ? (
            <span
              className="text-xs px-2 py-0.5 rounded-md font-medium"
              style={{ background: 'rgba(109,217,143,0.12)', color: 'var(--success)', border: '1px solid rgba(109,217,143,0.2)' }}
            >
              ✓ graduated
            </span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>
              {timeSince(coin.launched_at)}
            </span>
          )}
        </div>
      </div>

      {/* Bonding curve progress */}
      {!isGraduated && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--subtle)' }}>
            <Tooltip text="USDC collected toward graduation threshold">
              <span className="underline decoration-dotted underline-offset-2">Progress to grad</span>
            </Tooltip>
            <span className="mono">${feesUsd.toFixed(2)} / $420</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div
              className="h-full rounded-full progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Perp P&L */}
      <div className="flex items-center justify-between text-xs mt-1.5">
        {hasPnl ? (
          <>
            <Tooltip text="Unrealized P&L of the Hyperliquid perp position">
              <span style={{ color: 'var(--subtle)' }} className="underline decoration-dotted underline-offset-2">
                Perp P&L
              </span>
            </Tooltip>
            <span
              className="font-mono font-bold"
              style={{
                color: isProfit ? 'var(--success)' : 'var(--danger)',
                textShadow: isProfit ? '0 0 10px var(--success-glow)' : '0 0 10px var(--danger-glow)',
              }}
            >
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
            </span>
          </>
        ) : (
          <span className="text-xs italic" style={{ color: 'var(--subtle)' }}>
            Position opens at $20 collateral
          </span>
        )}
      </div>

      {/* Burn stat */}
      <div className="flex items-center justify-between text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
        <Tooltip text="Total tokens removed from supply via profit-take buybacks">
          <span className="underline decoration-dotted underline-offset-2">Burned</span>
        </Tooltip>
        <span className="mono">
          {parseFloat(coin.total_burned ?? '0').toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
        </span>
      </div>

      {/* Live indicator dot */}
      {hasPnl && !isGraduated && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--border)' }}>
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: 'var(--success)',
              boxShadow: '0 0 6px var(--success)',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }}
          />
          <span className="text-xs" style={{ color: 'var(--subtle)' }}>Position live</span>
        </div>
      )}
    </button>
  );
}
