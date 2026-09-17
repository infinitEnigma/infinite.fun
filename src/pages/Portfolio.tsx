import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';
import { api, type PortfolioData, type KeeperEvent } from '../api';
import { Footer } from '../components/Footer';
import { Tooltip } from '../components/Tooltip';

/* ── helpers ─────────────────────────────────────────────────── */
function fmt(n: string | number | null | undefined, decimals = 2) {
  const v = parseFloat(String(n ?? '0'));
  if (isNaN(v)) return '0.00';
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUSDC(n: string | number | null | undefined) {
  return `$${fmt(n, 2)}`;
}
function fmtAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_LABELS: Record<string, string> = {
  fee_claimed:    'Fee Claimed',
  margin_added:   'Margin Added',
  profit_taken:   'Profit Taken',
  buyback_burned: 'Buyback Burned',
  position_opened:'Position Opened',
  graduated:      'Graduated',
};
const EVENT_COLORS: Record<string, string> = {
  fee_claimed:    'var(--accent)',
  margin_added:   'var(--warn)',
  profit_taken:   'var(--success)',
  buyback_burned: 'var(--danger)',
  position_opened:'#7dd3fc',
  graduated:      '#a78bfa',
};

/* ── Stat card ───────────────────────────────────────────────── */
function StatCard({ label, value, sub, positive }: {
  label: string; value: string; sub?: string; positive?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="text-2xl font-bold mono"
        style={{ color: positive === undefined ? 'var(--text)' : positive ? 'var(--success)' : 'var(--danger)' }}>
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</span>}
    </div>
  );
}

/* ── Coin row ────────────────────────────────────────────────── */
function CoinRow({ coin, onClick }: { coin: PortfolioData['coins'][number]; onClick: () => void }) {
  const pnl = parseFloat(coin.total_pnl ?? '0');
  const col = parseFloat(coin.latest_collateral ?? '0');
  const pct = col > 0 ? (pnl / col) * 100 : null;
  const isGrad = !!coin.graduated_at;

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200"
      style={{ background: 'var(--surface-mid)', border: '1px solid var(--border-low)' }}
      onMouseEnter={e => {
        (e.currentTarget).style.borderColor = 'var(--accent)';
        (e.currentTarget).style.boxShadow = '0 0 0 1px var(--accent), var(--glow)';
      }}
      onMouseLeave={e => {
        (e.currentTarget).style.borderColor = 'var(--border-low)';
        (e.currentTarget).style.boxShadow = 'none';
      }}
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
        style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
        {coin.ticker.slice(0, 2)}
      </div>

      {/* Name + market */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">${coin.ticker}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-hi)', color: 'var(--muted)' }}>
            {coin.market}
          </span>
          {isGrad && (
            <span className="text-xs px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
              Graduated
            </span>
          )}
        </div>
        <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>
          {coin.name} · {coin.leverage}× · {timeAgo(coin.launched_at)}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 text-right">
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Creator Fees</div>
          <div className="font-semibold mono text-sm">
            {fmtUSDC(parseFloat(coin.total_fees_claimed ?? '0') * 0.15)}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>Burned</div>
          <div className="font-semibold mono text-sm" style={{ color: 'var(--danger)' }}>
            {fmt(coin.total_burned ?? '0', 0)}
          </div>
        </div>
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>P&amp;L</div>
          <div className="font-semibold mono text-sm"
            style={{ color: pnl >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {pnl >= 0 ? '+' : ''}{fmtUSDC(pnl)}
            {pct !== null && (
              <span className="text-xs ml-1" style={{ opacity: 0.7 }}>
                ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Event row ───────────────────────────────────────────────── */
function EventRow({ ev, coinTicker }: { ev: KeeperEvent; coinTicker?: string }) {
  const color = EVENT_COLORS[ev.event_type] ?? 'var(--muted)';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: 'var(--border-low)' }}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium" style={{ color }}>
          {EVENT_LABELS[ev.event_type] ?? ev.event_type}
        </span>
        {coinTicker && (
          <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>${coinTicker}</span>
        )}
      </div>
      {ev.usdc_amount && (
        <span className="mono text-sm">{fmtUSDC(ev.usdc_amount)}</span>
      )}
      {ev.tokens_amount && !ev.usdc_amount && (
        <span className="mono text-sm" style={{ color: 'var(--danger)' }}>
          -{fmt(ev.tokens_amount, 0)} tokens
        </span>
      )}
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>
        {timeAgo(ev.created_at)}
      </span>
      {ev.tx_hash && (
        <a
          href={`https://explorer.arc.io/tx/${ev.tx_hash}`}
          target="_blank" rel="noopener noreferrer"
          className="text-xs flex-shrink-0"
          style={{ color: 'var(--accent)' }}
          onClick={e => e.stopPropagation()}
        >
          ↗
        </a>
      )}
    </div>
  );
}

/* ── Revenue chart ───────────────────────────────────────────── */
function RevenueChart({ data }: { data: { day: string; creator_fees: string }[] }) {
  const chartData = data.map(d => ({
    day: d.day.slice(5),
    fees: parseFloat(d.creator_fees),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm" style={{ color: 'var(--muted)' }}>
        No revenue data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="var(--accent)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-low)" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
        <ReTooltip
          contentStyle={{ background: 'var(--surface-hi)', border: '1px solid var(--border-mid)', borderRadius: 8 }}
          labelStyle={{ color: 'var(--muted)', fontSize: 11 }}
          formatter={(v: unknown) => [`$${fmt(v as number, 2)}`, 'Creator fees']}
        />
        <Area type="monotone" dataKey="fees" stroke="var(--accent)" strokeWidth={2}
          fill="url(#revGrad)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ── Main portfolio component ────────────────────────────────── */
function PortfolioContent({ walletAddress }: { walletAddress: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'coins' | 'activity' | 'revenue'>('coins');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.portfolio(walletAddress);
      setData(result);
    } catch {
      setError('Failed to load portfolio.');
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => { void load(); }, [load]);

  // Build ticker lookup for event rows
  const tickerMap = Object.fromEntries(
    (data?.coins ?? []).map(c => [c.address, c.ticker])
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <button onClick={() => void load()} className="btn-primary px-4 py-2 rounded-lg text-sm">
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats;
  const totalPnl = parseFloat(stats.total_pnl);
  const creatorFees = parseFloat(stats.total_creator_fees);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Portfolio
            <span className="text-base font-normal mono px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-mid)', color: 'var(--muted)' }}>
              {fmtAddr(walletAddress)}
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            All coins launched and activity for this wallet
          </p>
        </div>
        <button
          onClick={() => void navigate('/launch')}
          className="btn-primary px-4 py-2 rounded-xl text-sm self-start sm:self-auto"
        >
          + Launch Coin
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Coins Launched"
          value={stats.coin_count}
          sub={`${stats.graduated_count} graduated`}
        />
        <StatCard
          label="Creator Fees Earned"
          value={fmtUSDC(creatorFees)}
          sub="15% of all fee claims"
          positive={creatorFees >= 0}
        />
        <StatCard
          label="Total Burned"
          value={fmt(stats.total_burned, 0)}
          sub="tokens across all coins"
        />
        <StatCard
          label="Perp P&L"
          value={fmtUSDC(totalPnl)}
          sub="realized + unrealized"
          positive={totalPnl >= 0}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: 'var(--surface-mid)', border: '1px solid var(--border-low)' }}>
        {(['coins', 'activity', 'revenue'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all"
            style={{
              background: activeTab === tab ? 'var(--accent)' : 'transparent',
              color: activeTab === tab ? 'var(--bg)' : 'var(--muted)',
            }}
          >
            {tab}
            {tab === 'coins' && data.coins.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">({data.coins.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Coins */}
      {activeTab === 'coins' && (
        <div className="flex flex-col gap-2">
          {data.coins.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
              <div className="text-4xl opacity-30">∞</div>
              <p style={{ color: 'var(--muted)' }}>No coins launched yet.</p>
              <button
                onClick={() => void navigate('/launch')}
                className="btn-primary px-5 py-2 rounded-xl text-sm"
              >
                Launch your first coin
              </button>
            </div>
          ) : (
            data.coins.map(coin => (
              <CoinRow
                key={coin.address}
                coin={coin}
                onClick={() => void navigate(`/coin/${coin.address}`)}
              />
            ))
          )}
        </div>
      )}

      {/* Tab: Activity */}
      {activeTab === 'activity' && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Activity</h2>
            <Tooltip text="Keeper events across all your launched coins">
              <span className="text-xs cursor-help" style={{ color: 'var(--muted)', borderBottom: '1px dotted var(--muted)' }}>
                What is this?
              </span>
            </Tooltip>
          </div>
          {data.events.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>
              No activity yet — launch a coin and the keeper loop will populate this feed.
            </p>
          ) : (
            <div className="flex flex-col">
              {data.events.slice(0, 100).map(ev => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  coinTicker={tickerMap[ev.coin_address]}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Revenue */}
      {activeTab === 'revenue' && (
        <div className="flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Creator Fee Revenue</h2>
              <Tooltip text="You earn 15% of all bonding curve fees from your coins. This chart shows daily creator fees across your entire portfolio.">
                <span className="text-xs cursor-help" style={{ color: 'var(--muted)', borderBottom: '1px dotted var(--muted)' }}>
                  How is this calculated?
                </span>
              </Tooltip>
            </div>
            <RevenueChart data={data.revenueHistory} />
          </div>

          {/* Fee breakdown per coin */}
          {data.coins.length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-semibold mb-4">Breakdown by Coin</h2>
              <div className="flex flex-col gap-3">
                {[...data.coins]
                  .sort((a, b) =>
                    parseFloat(b.total_fees_claimed ?? '0') - parseFloat(a.total_fees_claimed ?? '0')
                  )
                  .map(coin => {
                    const totalFees = parseFloat(coin.total_fees_claimed ?? '0');
                    const creatorSlice = totalFees * 0.15;
                    const maxFees = Math.max(
                      ...data.coins.map(c => parseFloat(c.total_fees_claimed ?? '0') * 0.15),
                      1
                    );
                    const barPct = Math.min((creatorSlice / maxFees) * 100, 100);
                    return (
                      <div key={coin.address} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span
                            className="cursor-pointer hover:underline"
                            style={{ color: 'var(--accent)' }}
                            onClick={() => void navigate(`/coin/${coin.address}`)}
                          >
                            ${coin.ticker}
                          </span>
                          <span className="mono">{fmtUSDC(creatorSlice)}</span>
                        </div>
                        <div className="h-1.5 rounded-full" style={{ background: 'var(--border-low)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barPct}%`, background: 'var(--accent)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page wrapper ─────────────────────────────────────────────── */
export function Portfolio() {
  const { address: paramAddress } = useParams<{ address?: string }>();
  const { address: connectedAddress } = useAccount();
  const navigate = useNavigate();

  // If a specific address is in the URL, show that. Otherwise show connected wallet.
  const walletAddress = paramAddress ?? connectedAddress;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(7,9,18,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-low)' }}>
        <span
          className="text-xl font-bold cursor-pointer select-none"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          onClick={() => void navigate('/')}
        >
          <span style={{ color: 'var(--accent)', textShadow: '0 0 12px var(--accent)' }}>∞</span>
          <span style={{ color: 'var(--text)' }}>.fun</span>
        </span>
        <div className="flex items-center gap-3">
          <button onClick={() => void navigate('/')}
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => ((e.target as HTMLButtonElement).style.color = 'var(--text)')}
            onMouseLeave={e => ((e.target as HTMLButtonElement).style.color = 'var(--muted)')}>
            Feed
          </button>
          <button onClick={() => void navigate('/leaderboard')}
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--muted)' }}
            onMouseEnter={e => ((e.target as HTMLButtonElement).style.color = 'var(--text)')}
            onMouseLeave={e => ((e.target as HTMLButtonElement).style.color = 'var(--muted)')}>
            Leaderboard
          </button>
          <ConnectKitButton />
        </div>
      </nav>

      {/* Body */}
      {!walletAddress ? (
        <div className="flex flex-col items-center justify-center gap-6 py-32 px-4 text-center">
          <div className="text-5xl opacity-20" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>∞</div>
          <h2 className="text-2xl font-bold">Connect your wallet</h2>
          <p style={{ color: 'var(--muted)' }}>
            Connect your wallet to see your launched coins, creator fees, and activity.
          </p>
          <ConnectKitButton />
        </div>
      ) : (
        <PortfolioContent walletAddress={walletAddress} />
      )}

      <Footer />
    </div>
  );
}
