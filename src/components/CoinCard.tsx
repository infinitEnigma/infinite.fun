import type { FeedCoin } from '../api';

const MARKET_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', SOL: '◎', HYPE: '⚡',
  AAPL: '', NVDA: '', TSLA: '', MSFT: '', SPY: '📊',
};

interface Props {
  coin: FeedCoin;
  onClick: () => void;
  graduationThresholdUsdc?: number;
}

const GRAD_THRESHOLD = 420; // USDC

export function CoinCard({ coin, onClick }: Props) {
  const feesUsd = parseFloat(coin.total_fees_claimed ?? '0');
  const pnl = parseFloat(coin.latest_pnl ?? '0');
  const collateral = parseFloat(coin.latest_collateral ?? '0');
  const progress = Math.min((feesUsd / GRAD_THRESHOLD) * 100, 100);
  const pnlPct = collateral > 0 ? (pnl / collateral) * 100 : 0;
  const isGraduated = !!coin.graduated_at;
  const hasPnl = collateral > 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          {coin.image_url ? (
            <img src={coin.image_url} alt={coin.ticker} className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}
            >
              {coin.ticker.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
              ${coin.ticker}
            </div>
            <div className="text-xs" style={{ color: 'var(--subtle)' }}>
              {coin.name}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          {/* Market + leverage badge */}
          <span
            className="text-xs px-1.5 py-0.5 rounded font-mono"
            style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
          >
            {MARKET_ICONS[coin.market] ?? ''} {coin.market} {coin.leverage}×
          </span>
          {/* Graduated badge */}
          {isGraduated && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#1a4a2e', color: 'var(--success)' }}>
              graduated
            </span>
          )}
        </div>
      </div>

      {/* Bonding curve progress */}
      {!isGraduated && (
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--subtle)' }}>
            <span>Curve progress</span>
            <span className="mono">${feesUsd.toFixed(2)} / ${GRAD_THRESHOLD}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: 'var(--accent)' }}
            />
          </div>
        </div>
      )}

      {/* Perp P&L */}
      {hasPnl && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--subtle)' }}>Perp P&L</span>
          <span
            className="font-mono font-semibold"
            style={{ color: pnlPct >= 0 ? 'var(--success)' : 'var(--danger)' }}
          >
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Burn stats */}
      <div className="flex items-center justify-between text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
        <span>Burned</span>
        <span className="mono">
          {parseFloat(coin.total_burned ?? '0').toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
        </span>
      </div>
    </button>
  );
}
