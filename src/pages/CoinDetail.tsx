import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { api, type Coin, type PositionSnapshot } from '../api';
import { BuySellPanel } from '../components/BuySellPanel';
import { PerpPositionCard } from '../components/PerpPositionCard';
import { FeeSplitBar } from '../components/FeeSplitBar';
import { KeeperLog } from '../components/KeeperLog';
import { Tooltip } from '../components/Tooltip';
import { Footer } from '../components/Footer';
import { ConnectKitButton } from 'connectkit';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ReferenceLine,
} from 'recharts';

const MARKET_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', SOL: '◎', HYPE: '⚡',
};

const GRAD_THRESHOLD = 420;

export function CoinDetail() {
  const { address } = useParams<{ address: string }>();
  const navigate = useNavigate();
  const chainId = useChainId();
  const [coin, setCoin] = useState<Coin | null>(null);
  const [snapshots, setSnapshots] = useState<PositionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chart' | 'log' | 'split'>('chart');

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      try {
        const [{ coin: c }, { snapshots: s }] = await Promise.all([
          api.getCoin(address),
          api.getSnapshots(address, 200),
        ]);
        setCoin(c);
        setSnapshots(s);
      } finally {
        setLoading(false);
      }
    };
    void load();
    const iv = setInterval(() => void load(), 15_000);
    return () => clearInterval(iv);
  }, [address]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span className="text-sm" style={{ color: 'var(--subtle)' }}>Loading coin data…</span>
        </div>
      </div>
    );
  }

  if (!coin || !address) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-center">
          <div className="text-4xl mb-3" style={{ opacity: 0.4 }}>∞</div>
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>Coin not found.</p>
          <button
            onClick={() => { void navigate('/'); }}
            className="mt-4 px-4 py-2 text-sm rounded-xl btn-glow"
            style={{ background: 'var(--accent)', color: 'var(--bg)', fontWeight: 600 }}
          >
            Back to feed
          </button>
        </div>
      </div>
    );
  }

  const chartData = snapshots.map((s) => ({
    t: new Date(s.snapshotted_at).getTime(),
    pnl: parseFloat(s.unrealized_pnl),
    price: parseFloat(s.mark_price),
  }));

  const totalFees = parseFloat(coin.total_fees_claimed ?? '0');
  const totalBurned = parseFloat(coin.total_burned ?? '0');
  const totalPnl = parseFloat(coin.total_pnl ?? '0');
  const gradProgress = Math.min((totalFees / GRAD_THRESHOLD) * 100, 100);
  const isGraduated = !!coin.graduated_at;

  const latestPnl = chartData.length > 0 ? chartData[chartData.length - 1].pnl : null;
  const chartColor = latestPnl === null ? 'var(--accent)' : latestPnl >= 0 ? 'var(--success)' : 'var(--danger)';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-20 px-5 py-3 border-b flex items-center justify-between"
        style={{
          background: 'rgba(8,15,28,0.82)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderColor: 'var(--border)',
        }}
      >
        <button
          onClick={() => { void navigate('/'); }}
          className="display font-bold text-2xl tracking-tight focus:outline-none"
        >
          <span className="text-glow" style={{ color: 'var(--accent)' }}>∞</span>
          <span style={{ color: 'var(--ink)' }}>.fun</span>
        </button>
        <ConnectKitButton />
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        {/* Header */}
        <div className="flex items-start gap-5 mb-6 fade-up">
          {coin.image_url ? (
            <img
              src={coin.image_url} alt={coin.ticker}
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
              style={{ boxShadow: 'var(--shadow-md)', border: '2px solid var(--border-mid)' }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0 display"
              style={{
                background: 'linear-gradient(135deg, var(--surface-strong), var(--surface-muted))',
                color: 'var(--accent)',
                border: '2px solid var(--border-mid)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {coin.ticker.slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="display text-3xl font-bold" style={{ color: 'var(--ink)' }}>${coin.ticker}</h1>
              <Tooltip text={`Perpetual market: ${coin.market} at ${coin.leverage}× leverage on Hyperliquid`}>
                <span
                  className="text-xs px-2 py-0.5 rounded-lg mono font-medium cursor-help"
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
                  className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(109,217,143,0.12)', color: 'var(--success)', border: '1px solid rgba(109,217,143,0.2)' }}
                >
                  ✓ Graduated
                </span>
              ) : null}
            </div>
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>{coin.name}</p>
            {coin.description && (
              <p className="text-sm mt-1 max-w-md" style={{ color: 'var(--muted)' }}>{coin.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <a
                href={`https://explorer.testnet.arc.io/address/${address}`}
                target="_blank" rel="noopener noreferrer"
                className="text-xs mono underline underline-offset-2 hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--subtle)' }}
              >
                {address.slice(0, 8)}…{address.slice(-6)} ↗
              </a>
              <span className="text-xs" style={{ color: 'var(--subtle)', opacity: 0.5 }}>|</span>
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                by {coin.creator.slice(0, 6)}…{coin.creator.slice(-4)}
              </span>
            </div>
          </div>
        </div>

        {/* Graduation progress (if not graduated) */}
        {!isGraduated && (
          <div
            className="p-4 rounded-2xl mb-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-between text-xs mb-2">
              <Tooltip text="Total USDC fees collected toward the $420 graduation threshold">
                <span className="underline decoration-dotted underline-offset-2 cursor-help" style={{ color: 'var(--subtle)' }}>
                  Graduation progress
                </span>
              </Tooltip>
              <span className="mono font-semibold" style={{ color: 'var(--accent)' }}>
                ${totalFees.toFixed(2)} / $420 USDC
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-muted)' }}>
              <div className="h-full rounded-full progress-bar" style={{ width: `${gradProgress}%` }} />
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--subtle)', opacity: 0.7 }}>
              At $420 USDC the curve closes and liquidity migrates to Uniswap V2.
            </p>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 fade-up" style={{ animationDelay: '0.05s' }}>
          <StatCard label="Total fees" value={`$${totalFees.toFixed(2)}`} tip="Cumulative USDC fees claimed from the bonding curve" />
          <StatCard
            label="Total burned"
            value={totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            sub="tokens"
            tip="Tokens permanently removed from supply via buyback-burns"
          />
          <StatCard
            label="Total P&L"
            value={`${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(2)}`}
            accent={totalPnl >= 0}
            danger={totalPnl < 0}
            tip="Cumulative realized P&L from profit-take slices"
          />
          <StatCard
            label="Creator"
            value={`${coin.creator.slice(0, 6)}…${coin.creator.slice(-4)}`}
            mono
            tip="Wallet address that launched this coin"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left — chart + buy/sell */}
          <div className="lg:col-span-2 space-y-4 fade-up" style={{ animationDelay: '0.08s' }}>
            {/* Tabs */}
            <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              {(['chart', 'log', 'split'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: activeTab === t ? 'var(--surface-strong)' : 'transparent',
                    color: activeTab === t ? 'var(--ink)' : 'var(--subtle)',
                    border: activeTab === t ? '1px solid var(--border-mid)' : '1px solid transparent',
                  }}
                >
                  {t === 'split' ? 'Fee split' : t === 'log' ? 'Keeper log' : 'P&L chart'}
                </button>
              ))}
            </div>

            {activeTab === 'chart' && (
              <div
                className="p-4 rounded-2xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold display" style={{ color: 'var(--muted)' }}>Unrealized P&L history</span>
                  {latestPnl !== null && (
                    <span
                      className="text-sm font-bold mono"
                      style={{ color: latestPnl >= 0 ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {latestPnl >= 0 ? '+' : ''}${latestPnl.toFixed(2)}
                    </span>
                  )}
                </div>
                {chartData.length < 2 ? (
                  <div className="h-52 flex flex-col items-center justify-center text-sm gap-2" style={{ color: 'var(--subtle)' }}>
                    <div className="text-3xl opacity-30">📈</div>
                    <p>P&L history appears once the keeper starts running.</p>
                    <p className="text-xs opacity-70">Position opens at $20 collateral.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColor} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="t" type="number" domain={['dataMin', 'dataMax']}
                        tickFormatter={(v: number) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--subtle)' }} tickLine={false} axisLine={false}
                        tickFormatter={(v: number) => `$${v.toFixed(1)}`}
                      />
                      <RTooltip
                        contentStyle={{ background: '#111e35', border: '1px solid var(--border-mid)', borderRadius: 10, fontSize: 12 }}
                        formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Unrealized P&L']}
                        labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                      />
                      <ReferenceLine y={0} stroke="var(--border-mid)" strokeDasharray="4 3" />
                      <Area
                        type="monotone" dataKey="pnl"
                        stroke={chartColor} strokeWidth={2}
                        fill="url(#pnlGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === 'log' && (
              <div
                className="p-4 rounded-2xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold display" style={{ color: 'var(--muted)' }}>Keeper events</span>
                  <span className="text-xs" style={{ color: 'var(--subtle)' }}>Refreshes every 15s</span>
                </div>
                <KeeperLog coinAddress={address} />
              </div>
            )}

            {activeTab === 'split' && (
              <div
                className="p-4 rounded-2xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <FeeSplitBar totalFeesUsdc={totalFees} />
              </div>
            )}

            {/* Buy/sell */}
            <BuySellPanel
              curveAddress={coin.curve as `0x${string}`}
              tokenAddress={address as `0x${string}`}
              chainId={chainId}
            />
          </div>

          {/* Right — perp + addresses */}
          <div className="space-y-4 fade-up" style={{ animationDelay: '0.12s' }}>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--subtle)' }}>
              Live position
            </p>
            <PerpPositionCard coinAddress={address} market={coin.market} leverage={coin.leverage} />

            {/* Contract addresses */}
            <div
              className="p-4 rounded-2xl border text-xs space-y-2.5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--muted)' }}>Contracts</p>
              {[
                { label: 'Token', addr: address },
                { label: 'SubWallet', addr: coin.sub_wallet },
                { label: 'Bonding curve', addr: coin.curve },
              ].map(({ label, addr }) => (
                <div key={label}>
                  <span style={{ color: 'var(--subtle)' }}>{label}</span>
                  <a
                    href={`https://explorer.testnet.arc.io/address/${addr}`}
                    target="_blank" rel="noopener noreferrer"
                    className="block mono mt-0.5 hover:text-[var(--accent)] transition-colors"
                    style={{ color: 'var(--ink-2)', wordBreak: 'break-all' }}
                  >
                    {addr.slice(0, 10)}…{addr.slice(-8)} ↗
                  </a>
                </div>
              ))}
            </div>

            {/* Info box */}
            <div
              className="p-4 rounded-2xl border text-xs leading-relaxed space-y-2"
              style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
            >
              <p style={{ color: 'var(--muted)', fontWeight: 600 }}>How this coin works</p>
              <p style={{ color: 'var(--subtle)' }}>
                Every buy and sell on the bonding curve charges a 1% fee.
                Fees accumulate in the SubWallet.
              </p>
              <p style={{ color: 'var(--subtle)' }}>
                The keeper runs every 15 seconds. It claims fees, posts 50% as perp margin,
                pays 15% to the creator, 20% to treasury, and burns 15% via buyback.
              </p>
              <p style={{ color: 'var(--subtle)' }}>
                When P&L hits +50%, 25% of the position is closed and the profit
                is used to burn more supply. The remaining position stays open forever.
              </p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function StatCard({ label, value, sub, accent, danger, mono, tip }: {
  label: string; value: string; sub?: string;
  accent?: boolean; danger?: boolean; mono?: boolean; tip?: string;
}) {
  const valueColor = accent ? 'var(--success)' : danger ? 'var(--danger)' : 'var(--ink)';
  const inner = (
    <div
      className="p-3 rounded-2xl border transition-all hover:border-[var(--border-mid)]"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>{label}</div>
      <div
        className={`text-base font-bold ${mono ? 'mono' : 'display'}`}
        style={{ color: valueColor }}
      >
        {value}
        {sub && <span className="text-xs font-normal ml-1" style={{ color: 'var(--subtle)' }}>{sub}</span>}
      </div>
    </div>
  );
  return tip ? <Tooltip text={tip}>{inner}</Tooltip> : inner;
}
