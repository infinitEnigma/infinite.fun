import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog, parseAbi } from 'viem';
import { toast } from 'sonner';
import { ConnectKitButton } from 'connectkit';
import { Tooltip } from '../components/Tooltip';
import { Footer } from '../components/Footer';
import { api } from '../api';

const MARKETS = [
  { id: 'BTC',  label: 'Bitcoin',    group: 'Crypto',  icon: '₿' },
  { id: 'ETH',  label: 'Ethereum',   group: 'Crypto',  icon: 'Ξ' },
  { id: 'SOL',  label: 'Solana',     group: 'Crypto',  icon: '◎' },
  { id: 'HYPE', label: 'HYPE',       group: 'Crypto',  icon: '⚡' },
  { id: 'AAPL', label: 'Apple',      group: 'Stocks',  icon: '' },
  { id: 'NVDA', label: 'NVIDIA',     group: 'Stocks',  icon: '' },
  { id: 'TSLA', label: 'Tesla',      group: 'Stocks',  icon: '' },
  { id: 'MSFT', label: 'Microsoft',  group: 'Stocks',  icon: '' },
  { id: 'SPY',  label: 'S&P 500 ETF', group: 'Stocks', icon: '📊' },
];

const FACTORY_ABI = parseAbi([
  'function launchCoin(string name, string ticker, string market, uint64 leverage, address feeDest, bool burnMode) returns (address token, address curve, address subWallet)',
  'event CoinLaunched(address indexed token, address indexed curve, address indexed subWallet, address creator, string name, string ticker)',
]);

const LEVERAGE_RISKS: Record<number, { label: string; color: string }> = {
  1: { label: 'Conservative', color: 'var(--success)' },
  5: { label: 'Moderate', color: 'var(--accent)' },
  10: { label: 'Aggressive', color: 'var(--warn)' },
  20: { label: 'High risk', color: 'var(--danger)' },
  25: { label: 'Extreme', color: 'var(--danger)' },
};
function leverageRisk(lev: number) {
  const keys = [1, 5, 10, 20, 25];
  const closest = keys.reduce((p, c) => (Math.abs(c - lev) < Math.abs(p - lev) ? c : p));
  return LEVERAGE_RISKS[closest];
}

export function LaunchForm() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [description, setDescription] = useState('');
  const [market, setMarket] = useState('BTC');
  const [leverage, setLeverage] = useState(5);
  const [burnMode, setBurnMode] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { writeContract, data: txHash } = useWriteContract();
  const { data: receipt } = useWaitForTransactionReceipt({
    hash: txHash, query: { enabled: !!txHash },
  });

  const factoryAddress = import.meta.env.VITE_FACTORY_ADDRESS as `0x${string}` | undefined;

  const handleImage = (f: File) => {
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!address || !name || !ticker || !factoryAddress) return;
    setSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) imageUrl = await api.uploadImage(imageFile);

      writeContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'launchCoin',
        args: [name, ticker.toUpperCase(), market, BigInt(leverage), address, burnMode],
      });
      toast.info('Confirm the launch transaction in your wallet');

      if (receipt) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === 'CoinLaunched') {
              const { token, curve, subWallet } = decoded.args as {
                token: `0x${string}`; curve: `0x${string}`; subWallet: `0x${string}`;
              };
              await api.createCoin({
                address: token, name, ticker: ticker.toUpperCase(),
                description, imageUrl, creator: address,
                market, leverage, feeDest: address, burnMode, subWallet, curve,
              });
              toast.success(`$${ticker.toUpperCase()} launched!`);
              void navigate(`/coin/${token}`);
              return;
            }
          } catch { /* non-matching log */ }
        }
      }
    } catch {
      toast.error('Launch failed. Make sure your wallet is connected and has USDC for gas.');
    } finally {
      setSubmitting(false);
    }
  };

  const groups = Array.from(new Set(MARKETS.map((m) => m.group)));
  const risk = leverageRisk(leverage);
  const selectedMarket = MARKETS.find((m) => m.id === market);

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

      <div className="max-w-lg mx-auto px-4 py-10 relative z-10">
        <div className="fade-up">
          <h1 className="display text-4xl font-bold mb-1" style={{ color: 'var(--ink)' }}>Launch a coin</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--subtle)' }}>
            Set it once. The engine runs forever — fees fund the position, profits burn supply.
          </p>
        </div>

        <div className="space-y-6 fade-up" style={{ animationDelay: '0.06s' }}>
          {/* Image upload */}
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              Coin image
            </label>
            <div
              className="flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:border-[var(--border-mid)]"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview"
                  className="w-14 h-14 rounded-2xl object-cover flex-shrink-0"
                  style={{ border: '2px solid var(--border-mid)' }}
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: 'var(--surface-muted)', border: '2px dashed var(--border-mid)' }}
                >
                  🪙
                </div>
              )}
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>
                  {imageFile ? imageFile.name : 'Upload coin image'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>PNG, JPG, WebP — max 2 MB</p>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
            </div>
          </div>

          <Field label="Token name" placeholder="Infinite Coin" value={name} onChange={setName} />
          <Field
            label="Ticker"
            placeholder="INF"
            value={ticker}
            onChange={(v) => setTicker(v.toUpperCase().slice(0, 10))}
            help="Max 10 characters. Will be prefixed with $ on-screen."
          />
          <Field label="Description" placeholder="One line about the coin and its mission" value={description} onChange={setDescription} textarea />

          {/* Market selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Perp market
              </label>
              <Tooltip text="The perpetual futures market your coin's position will track on Hyperliquid.">
                <span className="text-xs cursor-help" style={{ color: 'var(--subtle)' }}>What's this? ⓘ</span>
              </Tooltip>
            </div>
            <div className="space-y-3">
              {groups.map((g) => (
                <div key={g}>
                  <div className="text-xs mb-1.5 font-medium" style={{ color: 'var(--subtle)' }}>{g}</div>
                  <div className="flex flex-wrap gap-2">
                    {MARKETS.filter((m) => m.group === g).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMarket(m.id)}
                        className="px-3 py-1.5 text-xs rounded-xl border transition-all btn-glow"
                        style={{
                          background: market === m.id ? 'rgba(122,173,223,0.15)' : 'var(--surface)',
                          borderColor: market === m.id ? 'var(--accent)' : 'var(--border)',
                          color: market === m.id ? 'var(--accent)' : 'var(--muted)',
                          fontWeight: market === m.id ? 600 : 400,
                          boxShadow: market === m.id ? '0 0 10px rgba(122,173,223,0.15)' : 'none',
                        }}
                      >
                        {m.icon} {m.id} · {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div
            className="p-4 rounded-2xl border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  Leverage
                </label>
                <Tooltip text="Higher leverage amplifies gains AND losses. The position is never manually closed, so extreme leverage can liquidate if the market moves against you.">
                  <span className="text-xs cursor-help" style={{ color: 'var(--subtle)' }}>ⓘ</span>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono font-bold text-lg" style={{ color: 'var(--accent)' }}>{leverage}×</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-lg"
                  style={{
                    background: `${risk.color}18`,
                    color: risk.color,
                    border: `1px solid ${risk.color}30`,
                  }}
                >
                  {risk.label}
                </span>
              </div>
            </div>
            <input
              type="range" min={1} max={25} step={1} value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs mt-1.5" style={{ color: 'var(--subtle)' }}>
              <span>1× safe</span><span>25× extreme</span>
            </div>
          </div>

          {/* Fee destination */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                15% fee destination
              </label>
              <Tooltip text="The extra 15% slice of every fee claim. You always get your 15% creator share separately.">
                <span className="text-xs cursor-help" style={{ color: 'var(--subtle)' }}>ⓘ</span>
              </Tooltip>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: true, label: '🔥 Buyback & burn', desc: 'Buys tokens on the curve and burns them — reduces supply on every claim.' },
                { value: false, label: '💧 LP slice', desc: 'Accumulates as liquidity in the bonding curve pool.' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setBurnMode(opt.value)}
                  className="p-3 rounded-2xl border text-left transition-all"
                  style={{
                    background: burnMode === opt.value ? 'var(--surface-strong)' : 'var(--surface)',
                    borderColor: burnMode === opt.value ? 'var(--accent)' : 'var(--border)',
                    boxShadow: burnMode === opt.value ? '0 0 14px rgba(122,173,223,0.12)' : 'none',
                  }}
                >
                  <div className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{opt.label}</div>
                  <div className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--subtle)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fee split preview */}
          <div
            className="p-4 rounded-2xl border"
            style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>
              Fee split preview
            </div>
            {/* Mini bar */}
            <div className="flex h-2 rounded-full overflow-hidden gap-px mb-3">
              <div style={{ width: '50%', background: 'var(--accent)' }} />
              <div style={{ width: '15%', background: '#7dd3fc' }} />
              <div style={{ width: '20%', background: 'var(--muted)' }} />
              <div style={{ width: '15%', background: burnMode ? 'var(--success)' : '#7dd3fc' }} />
            </div>
            <div className="space-y-1.5">
              {[
                ['50%', 'Perp margin', 'Grows the Hyperliquid position'],
                ['15%', 'You (creator)', `Sent to ${address ? address.slice(0, 8) + '…' : 'your wallet'}`],
                ['20%', 'Protocol treasury', 'Funds protocol development'],
                ['15%', burnMode ? 'Buyback & burn' : 'LP slice', burnMode ? 'Reduces token supply' : 'Adds liquidity to curve'],
              ].map(([pct, label, desc]) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold" style={{ color: 'var(--ink-2)' }}>{label}</span>
                    <span className="ml-1.5" style={{ color: 'var(--subtle)' }}>{desc}</span>
                  </div>
                  <span className="mono font-bold" style={{ color: 'var(--accent)' }}>{pct}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Launch summary */}
          {name && ticker && (
            <div
              className="p-4 rounded-2xl border text-sm"
              style={{ background: 'rgba(122,173,223,0.05)', borderColor: 'rgba(122,173,223,0.2)' }}
            >
              <div className="font-bold mb-1" style={{ color: 'var(--accent)' }}>
                {selectedMarket?.icon} ${ticker} · {name}
              </div>
              <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                Will open a {leverage}× {market} long on Hyperliquid once $20 in fees accrues.
                Graduates to Uniswap at $420 USDC.
              </p>
            </div>
          )}

          {/* Submit */}
          {!address ? (
            <div className="w-full">
              <ConnectKitButton />
            </div>
          ) : (
            <button
              onClick={() => { void handleSubmit(); }}
              disabled={!name || !ticker || submitting}
              className="w-full py-3.5 rounded-2xl font-bold text-sm btn-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: 'var(--bg)', borderTopColor: 'transparent' }}
                  />
                  Launching…
                </span>
              ) : (
                `Launch $${ticker || 'coin'} →`
              )}
            </button>
          )}

          <p className="text-xs text-center" style={{ color: 'var(--subtle)', opacity: 0.7 }}>
            Launching a coin creates three smart contracts on Arc Testnet and costs a small USDC gas fee.
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function Field({
  label, placeholder, value, onChange, textarea, help,
}: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; textarea?: boolean; help?: string;
}) {
  const cls = 'w-full px-4 py-3 rounded-xl border text-sm outline-none transition-all focus:border-[var(--accent)] bg-transparent';
  const style = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</label>
        {help && (
          <Tooltip text={help}>
            <span className="text-xs cursor-help" style={{ color: 'var(--subtle)' }}>ⓘ</span>
          </Tooltip>
        )}
      </div>
      {textarea ? (
        <textarea
          rows={2} className={cls} style={style}
          placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="text" className={cls} style={style}
          placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
