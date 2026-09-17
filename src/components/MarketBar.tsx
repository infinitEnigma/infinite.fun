import { useEffect, useState, useRef } from 'react';
import { api, type MarketPrice } from '../api';

/**
 * MarketBar — a compact horizontal bar showing the 9 supported markets
 * with live price, colored status dot (up/down today), and a subtle
 * hover tooltip with confidence interval and last update time.
 *
 * Sits between the hero section and the coin feed.
 * Doubles as a filter hint — clicking a market card sets the feed filter.
 */

const MARKET_ICONS: Record<string, string> = {
  BTC: '₿',
  ETH: 'Ξ',
  SOL: '◎',
  HYPE: '⚡',
  AAPL: '',
  NVDA: '⬛',
  TSLA: '⚡',
  MSFT: '⊞',
  SPY: '📈',
};

function fmt(price: number): string {
  if (price >= 10_000) return `$${(price / 1000).toFixed(1)}k`;
  if (price >= 1000)   return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 10)     return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

function timeSince(publishTime: number): string {
  const secs = Math.floor(Date.now() / 1000) - publishTime;
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

interface MarketCardProps {
  p: MarketPrice;
  active: boolean;
  onClick: () => void;
}

function MarketCard({ p, active, onClick }: MarketCardProps) {
  const up = (p.change24h ?? 0) >= 0;
  const hasChange = p.change24h !== null;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl transition-all cursor-pointer flex-shrink-0"
      style={{
        background: active ? 'var(--surface)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: active ? '0 0 12px rgba(122,173,223,0.15)' : 'none',
        minWidth: '80px',
      }}
      title={`${p.symbol} • ±$${p.confidence.toFixed(2)} confidence • updated ${timeSince(p.publishTime)}`}
    >
      {/* Status dot */}
      <span
        className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
        style={{
          background: hasChange
            ? (up ? 'var(--success)' : 'var(--danger)')
            : 'var(--border-mid)',
          boxShadow: hasChange
            ? `0 0 6px ${up ? 'rgba(52,211,153,0.6)' : 'rgba(248,113,113,0.6)'}`
            : 'none',
        }}
      />

      {/* Symbol + icon */}
      <div className="flex items-center gap-1">
        <span className="text-xs" style={{ opacity: 0.5 }}>{MARKET_ICONS[p.symbol] ?? ''}</span>
        <span
          className="mono text-xs font-bold"
          style={{ color: active ? 'var(--accent)' : 'var(--text)' }}
        >
          {p.symbol}
        </span>
      </div>

      {/* Price */}
      <span className="mono text-xs font-semibold" style={{ color: 'var(--ink)' }}>
        {fmt(p.price)}
      </span>

      {/* 24h change */}
      {hasChange ? (
        <span
          className="text-xs font-medium"
          style={{ color: up ? 'var(--success)' : 'var(--danger)', fontSize: '10px' }}
        >
          {up ? '+' : ''}{p.change24h!.toFixed(2)}%
        </span>
      ) : (
        <span className="text-xs" style={{ color: 'var(--muted)', fontSize: '10px' }}>—</span>
      )}
    </button>
  );
}

interface MarketBarProps {
  /** Currently active market filter (e.g. "BTC"). Pass "All" or undefined for none. */
  activeMarket?: string;
  onSelect?: (symbol: string) => void;
}

export function MarketBar({ activeMarket, onSelect }: MarketBarProps) {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const result = await api.prices();
      setPrices(result.prices);
    } catch {
      // silently keep previous
    }
  };

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => { void load(); }, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (prices.length === 0) {
    // Skeleton
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl flex-shrink-0 animate-pulse"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              width: 80,
              height: 64,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {prices.map((p) => (
        <MarketCard
          key={p.symbol}
          p={p}
          active={activeMarket === p.symbol}
          onClick={() => onSelect?.(p.symbol)}
        />
      ))}
    </div>
  );
}
