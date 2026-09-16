import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { decodeEventLog, parseAbi } from 'viem';
import { toast } from 'sonner';
import { ConnectKitButton } from 'connectkit';
import { api } from '../api';

const MARKETS = [
  { id: 'BTC', label: 'Bitcoin', group: 'Crypto' },
  { id: 'ETH', label: 'Ethereum', group: 'Crypto' },
  { id: 'SOL', label: 'Solana', group: 'Crypto' },
  { id: 'HYPE', label: 'HYPE', group: 'Crypto' },
  { id: 'AAPL', label: 'Apple', group: 'Stocks' },
  { id: 'NVDA', label: 'NVIDIA', group: 'Stocks' },
  { id: 'TSLA', label: 'Tesla', group: 'Stocks' },
  { id: 'MSFT', label: 'Microsoft', group: 'Stocks' },
  { id: 'SPY', label: 'S&P 500 ETF', group: 'Stocks' },
];

const FACTORY_ABI = parseAbi([
  'function launchCoin(string name, string ticker, string market, uint64 leverage, address feeDest, bool burnMode) returns (address token, address curve, address subWallet)',
  'event CoinLaunched(address indexed token, address indexed curve, address indexed subWallet, address creator, string name, string ticker)',
]);

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
    hash: txHash,
    query: { enabled: !!txHash },
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
      // Upload image if provided
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await api.uploadImage(imageFile);
      }

      // Call LaunchpadFactory.launchCoin
      writeContract({
        address: factoryAddress,
        abi: FACTORY_ABI,
        functionName: 'launchCoin',
        args: [name, ticker.toUpperCase(), market, BigInt(leverage), address, burnMode],
      });

      toast.info('Confirm the launch transaction in your wallet');

      // Wait for receipt and parse CoinLaunched event
      if (receipt) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
            if (decoded.eventName === 'CoinLaunched') {
              const { token, curve, subWallet } = decoded.args as {
                token: `0x${string}`; curve: `0x${string}`; subWallet: `0x${string}`;
              };
              // Persist metadata to backend
              await api.createCoin({
                address: token, name, ticker: ticker.toUpperCase(),
                description, imageUrl, creator: address,
                market, leverage, feeDest: address,
                burnMode, subWallet, curve,
              });
              toast.success(`$${ticker.toUpperCase()} launched!`);
              void navigate(`/coin/${token}`);
              return;
            }
          } catch { /* non-matching log */ }
        }
      }
    } catch {
      toast.error('Launch failed');
    } finally {
      setSubmitting(false);
    }
  };

  const groups = Array.from(new Set(MARKETS.map((m) => m.group)));

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-gradient)' }}>
      <nav
        className="sticky top-0 z-10 px-4 py-3 border-b flex items-center justify-between"
        style={{ background: 'rgba(13,27,47,0.85)', backdropFilter: 'blur(12px)', borderColor: 'var(--border)' }}
      >
        <button onClick={() => { void navigate('/'); }} className="display font-bold text-xl" style={{ color: 'var(--ink)' }}>
          ← infinite.fun
        </button>
        <ConnectKitButton />
      </nav>

      <div className="max-w-lg mx-auto px-4 py-10">
        <h1 className="display text-3xl font-bold mb-1" style={{ color: 'var(--ink)' }}>Launch a coin</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--subtle)' }}>
          Every coin backs a live perpetual. Set it once — the engine runs forever.
        </p>

        <div className="space-y-5">
          {/* Image upload */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Coin image</label>
            <div
              className="flex items-center gap-4 p-3 rounded-xl border cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              onClick={() => fileRef.current?.click()}
            >
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl" style={{ background: 'var(--surface-muted)' }}>
                  🪙
                </div>
              )}
              <span className="text-sm" style={{ color: 'var(--subtle)' }}>
                {imageFile ? imageFile.name : 'Click to upload (PNG, JPG, WebP — max 2 MB)'}
              </span>
              <input ref={fileRef} type="file" className="hidden" accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleImage(e.target.files[0])} />
            </div>
          </div>

          <Field label="Token name" placeholder="Infinite Coin" value={name} onChange={setName} />
          <Field label="Ticker" placeholder="INF" value={ticker} onChange={(v) => setTicker(v.toUpperCase().slice(0, 10))} />
          <Field label="Description (optional)" placeholder="One line about the coin" value={description} onChange={setDescription} textarea />

          {/* Market selector */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Perp market</label>
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g}>
                  <div className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>{g}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {MARKETS.filter((m) => m.group === g).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMarket(m.id)}
                        className="px-3 py-1.5 text-xs rounded-lg border transition-all"
                        style={{
                          background: market === m.id ? 'var(--accent)' : 'var(--surface)',
                          borderColor: market === m.id ? 'var(--accent)' : 'var(--border)',
                          color: market === m.id ? 'var(--bg)' : 'var(--muted)',
                        }}
                      >
                        {m.id} · {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <label style={{ color: 'var(--muted)' }}>Leverage</label>
              <span className="mono font-semibold" style={{ color: 'var(--accent)' }}>{leverage}×</span>
            </div>
            <input
              type="range" min={1} max={25} step={1} value={leverage}
              onChange={(e) => setLeverage(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
            <div className="flex justify-between text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
              <span>1×</span><span>25×</span>
            </div>
          </div>

          {/* Fee destination */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
              Your 15% creator fee — destination for extra 15% slice
            </label>
            <div className="flex gap-2">
              {[
                { value: true, label: 'Buyback & burn', desc: 'Burns supply on every claim' },
                { value: false, label: 'LP slice', desc: 'Accrues as liquidity in the pool' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setBurnMode(opt.value)}
                  className="flex-1 p-3 rounded-xl border text-left transition-all"
                  style={{
                    background: burnMode === opt.value ? 'var(--surface-strong)' : 'var(--surface)',
                    borderColor: burnMode === opt.value ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{opt.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Fee split preview */}
          <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: 'var(--surface-muted)' }}>
            <div className="font-medium mb-2" style={{ color: 'var(--muted)' }}>Fee split on every claim</div>
            {[
              ['50%', 'Perp margin (position grows)'],
              ['15%', 'You (creator)'],
              ['20%', 'Protocol treasury'],
              ['15%', burnMode ? 'Buyback & burn' : 'LP slice'],
            ].map(([pct, label]) => (
              <div key={label} className="flex justify-between">
                <span style={{ color: 'var(--subtle)' }}>{label}</span>
                <span className="mono font-semibold" style={{ color: 'var(--accent)' }}>{pct}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          {!address ? (
            <ConnectKitButton />
          ) : (
            <button
              onClick={() => { void handleSubmit(); }}
              disabled={!name || !ticker || submitting}
              className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              {submitting ? 'Launching…' : 'Launch coin'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, textarea }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; textarea?: boolean;
}) {
  const cls = "w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all focus:border-[var(--accent)] bg-transparent";
  const style = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' };
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>{label}</label>
      {textarea ? (
        <textarea rows={2} className={cls} style={style} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type="text" className={cls} style={style} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
