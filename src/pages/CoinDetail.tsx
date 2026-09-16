import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChainId } from 'wagmi';
import { api, type Coin, type PositionSnapshot } from '../api';
import { BuySellPanel } from '../components/BuySellPanel';
import { PerpPositionCard } from '../components/PerpPositionCard';
import { FeeSplitBar } from '../components/FeeSplitBar';
import { KeeperLog } from '../components/KeeperLog';
import { ConnectKitButton } from 'connectkit';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';

const MARKET_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', SOL: '◎', HYPE: '⚡',
};

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
        <div className="animate-pulse text-sm" style={{ color: 'var(--subtle)' }}>Loading…</div>
      </div>
    );
  }

  if (!coin || !address) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-sm" style={{ color: 'var(--subtle)' }}>Coin not found.</div>
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ background: 'rgba(13,27,47,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
      >
        <button onClick={() => { void navigate('/'); }} className="display font-bold text-xl" style={{ color: 'var(--ink)' }}>
          ← infinite.fun
        </button>
        <ConnectKitButton />
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          {coin.image_url ? (
            <img src={coin.image_url} alt={coin.ticker} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}
            >
              {coin.ticker.slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                ${coin.ticker}
              </h1>
              <span
                className="text-xs px-2 py-0.5 rounded font-mono"
                style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
              >
                {MARKET_ICONS[coin.market] ?? ''} {coin.market} {coin.leverage}×
              </span>
              {coin.graduated_at && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: '#1a4a2e', color: 'var(--success)' }}>
                  graduated
                </span>
              )}
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--subtle)' }}>{coin.name}</p>
            {coin.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{coin.description}</p>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total fees" value={`$${totalFees.toFixed(2)}`} />
          <StatCard label="Total burned" value={`${totalBurned.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="tokens" />
          <StatCard label="Total P&L" value={`$${parseFloat(coin.total_pnl ?? '0').toFixed(2)}`} accent />
          <StatCard label="Creator" value={`${coin.creator.slice(0, 6)}…${coin.creator.slice(-4)}`} mono />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left — chart + buy/sell */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 p-0.5 rounded-lg w-fit" style={{ background: 'var(--surface-muted)' }}>
              {(['chart', 'log', 'split'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all capitalize"
                  style={{
                    background: activeTab === t ? 'var(--surface-strong)' : 'transparent',
                    color: activeTab === t ? 'var(--ink)' : 'var(--subtle)',
                  }}
                >
                  {t === 'split' ? 'Fee split' : t === 'log' ? 'Keeper log' : 'P&L chart'}
                </button>
              ))}
            </div>

            {activeTab === 'chart' && (
              <div
                className="p-4 rounded-xl border"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                {chartData.length < 2 ? (
                  <div className="h-48 flex items-center justify-center text-sm" style={{ color: 'var(--subtle)' }}>
                    P&L history will appear once the keeper starts running.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="t"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(v: number) => new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        tick={{ fontSize: 10, fill: 'var(--subtle)' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: 'var(--subtle)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `$${v.toFixed(1)}`}
                      />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Unrealized P&L']}
                        labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                      />
                      <ReferenceLine y={0} stroke="var(--border-strong)" strokeDasharray="4 2" />
                      <Line
                        type="monotone"
                        dataKey="pnl"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, fill: 'var(--accent)' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {activeTab === 'log' && <KeeperLog coinAddress={address} />}
            {activeTab === 'split' && (
              <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <FeeSplitBar totalFeesUsdc={totalFees} />
              </div>
            )}

            <BuySellPanel
              curveAddress={coin.curve as `0x${string}`}
              tokenAddress={address as `0x${string}`}
              chainId={chainId}
            />
          </div>

          {/* Right — perp card */}
          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider mb-0" style={{ color: 'var(--subtle)' }}>
              Live Position
            </div>
            <PerpPositionCard
              coinAddress={address}
              market={coin.market}
              leverage={coin.leverage}
            />

            {/* Sub-wallet link */}
            <div className="text-xs" style={{ color: 'var(--subtle)' }}>
              SubWallet:{' '}
              <a
                href={`https://explorer.testnet.arc.io/address/${coin.sub_wallet}`}
                target="_blank"
                rel="noreferrer"
                className="mono underline hover:text-[var(--accent)]"
              >
                {coin.sub_wallet.slice(0, 10)}…{coin.sub_wallet.slice(-6)}
              </a>
            </div>
            <div className="text-xs" style={{ color: 'var(--subtle)' }}>
              Bonding curve:{' '}
              <a
                href={`https://explorer.testnet.arc.io/address/${coin.curve}`}
                target="_blank"
                rel="noreferrer"
                className="mono underline hover:text-[var(--accent)]"
              >
                {coin.curve.slice(0, 10)}…{coin.curve.slice(-6)}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent, mono }: {
  label: string; value: string; sub?: string; accent?: boolean; mono?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>{label}</div>
      <div
        className={`text-base font-bold ${mono ? 'mono' : 'display'}`}
        style={{ color: accent ? 'var(--accent)' : 'var(--ink)' }}
      >
        {value}
        {sub && <span className="text-xs font-normal ml-1" style={{ color: 'var(--subtle)' }}>{sub}</span>}
      </div>
    </div>
  );
}
