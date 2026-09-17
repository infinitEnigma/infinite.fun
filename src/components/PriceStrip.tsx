import { useEffect, useState, useRef } from 'react';
import { api, type MarketPrice } from '../api';

/**
 * PriceStrip — horizontally scrolling ticker tape of live market prices.
 * Polls /api/prices every 15 seconds. Scrolls in the opposite direction
 * to the coin tape above it for visual contrast.
 * Pyth prices are used for accuracy; 24h change from CoinGecko where available.
 */

function fmt(price: number): string {
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 10)   return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function PriceItem({ p }: { p: MarketPrice }) {
  const hasChange = p.change24h !== null;
  const up = (p.change24h ?? 0) >= 0;

  return (
    <span
      className="inline-flex items-center gap-2 px-5 text-xs mono select-none whitespace-nowrap"
      style={{ color: 'var(--muted)' }}
    >
      <span className="font-semibold" style={{ color: 'var(--text)' }}>{p.symbol}</span>
      <span className="font-bold" style={{ color: 'var(--text)' }}>${fmt(p.price)}</span>
      {hasChange && (
        <span
          className="px-1.5 py-0.5 rounded text-xs font-semibold"
          style={{
            background: up
              ? 'rgba(52,211,153,0.12)'
              : 'rgba(248,113,113,0.12)',
            color: up ? 'var(--success)' : 'var(--danger)',
          }}
        >
          {up ? '▲' : '▼'} {Math.abs(p.change24h!).toFixed(2)}%
        </span>
      )}
      <span style={{ opacity: 0.25 }}>|</span>
    </span>
  );
}

export function PriceStrip() {
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [stale, setStale] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const result = await api.prices();
      setPrices(result.prices);
      setStale(result.stale ?? false);
    } catch {
      // silently keep previous prices on error
    }
  };

  useEffect(() => {
    void load();
    intervalRef.current = setInterval(() => { void load(); }, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (prices.length === 0) return null;

  // Duplicate items for seamless infinite loop (scroll right-to-left — opposite of coin tape)
  const items = [...prices, ...prices, ...prices];

  return (
    <div
      className="relative overflow-hidden rounded-xl py-2.5"
      style={{
        background: 'var(--surface-muted)',
        border: '1px solid var(--border)',
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
    >
      {/* Stale indicator */}
      {stale && (
        <div
          className="absolute top-1 right-2 text-xs px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--warn)', zIndex: 1 }}
        >
          delayed
        </div>
      )}

      {/* Scrolling content — opposite direction to coin tape */}
      <div
        style={{
          display: 'flex',
          animation: 'ticker-tape-reverse 45s linear infinite',
          willChange: 'transform',
        }}
      >
        {items.map((p, i) => (
          <PriceItem key={`${p.symbol}-${i}`} p={p} />
        ))}
      </div>
    </div>
  );
}
