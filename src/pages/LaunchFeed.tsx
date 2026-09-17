import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { api, type FeedCoin } from '../api';
import { CoinCard } from '../components/CoinCard';
import { Footer } from '../components/Footer';
import { PriceStrip } from '../components/PriceStrip';
import { MarketBar } from '../components/MarketBar';

const MARKETS = ['All', 'BTC', 'ETH', 'SOL', 'HYPE', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'SPY'];

/* ── Ticker tape item ───────────────────────────────────────────────── */
function TickerItem({ coin }: { coin: FeedCoin }) {
  const pnl = parseFloat(coin.latest_pnl ?? '0');
  const col = parseFloat(coin.latest_collateral ?? '0');
  const pct = col > 0 ? (pnl / col) * 100 : null;
  return (
    <span className="flex items-center gap-2 px-5 text-xs mono" style={{ color: 'var(--muted)' }}>
      <span className="font-semibold" style={{ color: 'var(--accent)' }}>${coin.ticker}</span>
      {pct !== null && (
        <span style={{ color: pct >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </span>
      )}
      <span style={{ opacity: 0.4 }}>·</span>
    </span>
  );
}

/* ── Flywheel SVG diagram ───────────────────────────────────────────── */
function Flywheel() {
  const nodes = [
    { label: 'Curve fees',   angle: -90,  color: 'var(--accent)' },
    { label: 'SubWallet',    angle: -18,  color: '#7dd3fc' },
    { label: 'Hyperliquid',  angle: 54,   color: 'var(--success)' },
    { label: 'Profit taken', angle: 126,  color: 'var(--warn)' },
    { label: 'Burn supply',  angle: 198,  color: 'var(--danger)' },
  ];
  const R = 72;
  const toXY = (deg: number) => ({
    x: R * Math.cos((deg * Math.PI) / 180),
    y: R * Math.sin((deg * Math.PI) / 180),
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="220" height="220" viewBox="-110 -110 220 220" className="opacity-90">
        {/* Dashed orbit ring */}
        <circle cx="0" cy="0" r={R} fill="none" stroke="var(--border-mid)" strokeWidth="1" strokeDasharray="4 4" />
        {/* Spinning arrow overlay */}
        <g style={{ transformOrigin: '0 0', animation: 'orbit 18s linear infinite' }}>
          <circle cx={R} cy="0" r="3" fill="var(--accent)" opacity="0.7" />
        </g>
        {/* Node circles */}
        {nodes.map((n) => {
          const { x, y } = toXY(n.angle);
          return (
            <g key={n.label}>
              <circle cx={x} cy={y} r="10" fill={n.color} opacity="0.15" />
              <circle cx={x} cy={y} r="5" fill={n.color} opacity="0.8"
                style={{ animation: `pulse-dot ${1.5 + nodes.indexOf(n) * 0.3}s ease-in-out infinite` }}
              />
            </g>
          );
        })}
        {/* Center ∞ symbol */}
        <text
          x="0" y="6" textAnchor="middle"
          fontSize="20" fontFamily="Space Grotesk, sans-serif"
          fill="var(--accent)" opacity="0.9"
        >
          ∞
        </text>
      </svg>
      {/* Node labels */}
      <div className="flex flex-wrap justify-center gap-2">
        {nodes.map((n) => (
          <span key={n.label} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ background: n.color }} />
            <span style={{ color: 'var(--subtle)' }}>{n.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Stats strip ────────────────────────────────────────────────────── */
interface StatsProps { coins: FeedCoin[]; }
function StatsStrip({ coins }: StatsProps) {
  const totalPerp = coins.reduce((s, c) => s + parseFloat(c.latest_collateral ?? '0'), 0);
  const totalBurned = coins.reduce((s, c) => s + parseFloat(c.total_burned ?? '0'), 0);
  const live = coins.filter((c) => parseFloat(c.latest_collateral ?? '0') > 0).length;

  return (
    <div className="grid grid-cols-3 gap-3 my-8">
      {[
        { label: 'Coins live', value: String(live), tip: 'Coins with an active perp position' },
        { label: 'USDC in perps', value: `$${totalPerp.toFixed(0)}`, tip: 'Total USDC collateral held across all SubWallets' },
        { label: 'Tokens burned', value: totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 }), tip: 'Total tokens removed from supply via buyback-burns' },
      ].map(({ label, value, tip }) => (
        <div
          key={label}
          className="p-4 rounded-2xl text-center"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
          }}
          title={tip}
        >
          <div className="display text-2xl font-bold text-glow" style={{ color: 'var(--accent)' }}>{value}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export function LaunchFeed() {
  const navigate = useNavigate();
  const [coins, setCoins] = useState<FeedCoin[]>([]);
  const [fetchCount, setFetchCount] = useState(0);
  const [market, setMarket] = useState('All');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (m: string, p: number, append: boolean) => {
    setFetchCount((n) => n + 1);
    try {
      const { coins: rows } = await api.feed({ market: m === 'All' ? undefined : m, page: p });
      setCoins((prev) => append ? [...prev, ...rows] : rows);
      setHasMore(rows.length === 20);
    } finally {
      setFetchCount((n) => n - 1);
    }
  }, []);

  useEffect(() => { void load(market, 1, false); }, [market, load]);

  const handleMarketChange = (m: string) => { setPage(1); setMarket(m); };

  const loading = fetchCount > 0;

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg-gradient)' }}>
      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 px-5 py-3 border-b flex items-center justify-between"
        style={{
          background: 'rgba(8,15,28,0.82)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderColor: 'var(--border)',
          boxShadow: '0 1px 0 var(--border)',
        }}
      >
        {/* Wordmark */}
        <button
          onClick={() => { void navigate('/'); }}
          className="display font-bold text-2xl tracking-tight focus:outline-none"
        >
          <span className="text-glow" style={{ color: 'var(--accent)' }}>∞</span>
          <span style={{ color: 'var(--ink)' }}>.fun</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { void navigate('/leaderboard'); }}
            className="px-3 py-1.5 text-xs rounded-xl border transition-all hover:border-[var(--border-mid)] hover:bg-[var(--surface)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Leaderboard
          </button>
          <button
            onClick={() => { void navigate('/portfolio'); }}
            className="px-3 py-1.5 text-xs rounded-xl border transition-all hover:border-[var(--border-mid)] hover:bg-[var(--surface)]"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            Portfolio
          </button>
          <ConnectKitButton />
          <button
            onClick={() => { void navigate('/launch'); }}
            className="px-4 py-1.5 text-xs font-bold rounded-xl btn-glow"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            + Launch
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10 relative z-10">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <div className="mb-2 fade-up">
          <div className="text-center mb-8">
            <h1 className="display text-5xl sm:text-6xl font-bold mb-4 leading-tight" style={{ color: 'var(--ink)' }}>
              Coins that own a{' '}
              <span className="text-glow" style={{ color: 'var(--accent)' }}>position.</span>
            </h1>
            <p className="text-base max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
              Every coin you launch is backed by a live leveraged perpetual on Hyperliquid.
              Bonding curve fees fund the margin. Profits burn supply.
              <strong style={{ color: 'var(--ink-2)' }}> The position never closes.</strong>
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => { void navigate('/launch'); }}
                className="px-6 py-3 rounded-2xl font-bold text-sm btn-glow"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                Launch your coin →
              </button>
              <a
                href="/paper"
                className="px-6 py-3 rounded-2xl font-medium text-sm border transition-all hover:border-[var(--border-mid)]"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                Read the paper
              </a>
            </div>
          </div>

          {/* Coin ticker tape */}
          {coins.length > 0 && (
            <div
              className="ticker-wrap rounded-2xl py-3 mb-2"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
            >
              <div className="ticker-inner">
                {[...coins, ...coins].map((c, i) => (
                  <TickerItem key={`${c.address}-${i}`} coin={c} />
                ))}
              </div>
            </div>
          )}

          {/* Live market price strip (Pyth) — scrolls opposite direction */}
          <div className="mb-2">
            <PriceStrip />
          </div>

          {/* Stats strip */}
          <StatsStrip coins={coins} />
        </div>

        {/* ── How it works ────────────────────────────────────────── */}
        <div
          className="mb-10 p-6 rounded-2xl fade-up"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-sm)',
            animationDelay: '0.1s',
          }}
        >
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <Flywheel />
            <div className="flex-1 space-y-4">
              <h2 className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>How the flywheel works</h2>
              {[
                ['①', '1% fee on every buy and sell flows into the SubWallet treasury.', 'var(--accent)'],
                ['②', 'Keeper splits fees 50/15/20/15 — perp margin, creator, treasury, burn.', 'var(--accent-2)'],
                ['③', 'Margin posts to Hyperliquid. Position grows with every fee claim.', '#7dd3fc'],
                ['④', 'At +50% P&L the keeper takes a 25% slice and uses it to buyback+burn.', 'var(--success)'],
                ['⑤', 'Supply shrinks. Position stays open. Fees keep flowing. Forever.', 'var(--warn)'],
              ].map(([num, text, color]) => (
                <div key={num} className="flex items-start gap-3">
                  <span className="display font-bold text-base flex-shrink-0 mt-0.5" style={{ color: color }}>{num}</span>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Market filter — MarketBar (live prices + clickable filter) ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--subtle)' }}>
              Markets
            </h2>
            {/* "All" reset button */}
            <button
              onClick={() => handleMarketChange('All')}
              className="text-xs px-2 py-0.5 rounded border transition-all"
              style={{
                borderColor: market === 'All' ? 'var(--accent)' : 'var(--border)',
                color: market === 'All' ? 'var(--accent)' : 'var(--muted)',
                background: market === 'All' ? 'var(--accent-glow)' : 'transparent',
              }}
            >
              All
            </button>
          </div>
          <MarketBar
            activeMarket={market === 'All' ? undefined : market}
            onSelect={(sym) => handleMarketChange(sym)}
          />
        </div>

        {/* Legacy market buttons (hidden — keeping MARKETS array for other uses) */}
        <div className="hidden">
          {MARKETS.map((m) => (
            <button
              key={m}
              onClick={() => handleMarketChange(m)}
            >
              {m}
            </button>
          ))}
        </div>

        {/* ── Coin grid ───────────────────────────────────────────── */}
        {loading && coins.length === 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        ) : coins.length === 0 ? (
          <div className="text-center py-24" style={{ color: 'var(--subtle)' }}>
            <div
              className="text-6xl mb-4 display font-bold text-glow"
              style={{ color: 'var(--accent)', opacity: 0.5 }}
            >
              ∞
            </div>
            <p className="text-sm">No coins yet. Be the first to launch.</p>
            <button
              onClick={() => { void navigate('/launch'); }}
              className="mt-4 px-5 py-2 rounded-xl text-sm btn-glow"
              style={{ background: 'var(--accent)', color: 'var(--bg)', fontWeight: 600 }}
            >
              Launch the first coin
            </button>
          </div>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coins.map((c) => (
                <CoinCard key={c.address} coin={c} onClick={() => { void navigate(`/coin/${c.address}`); }} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => { const next = page + 1; setPage(next); void load(market, next, true); }}
                  className="px-6 py-2 text-sm rounded-xl border transition-all hover:border-[var(--border-mid)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
