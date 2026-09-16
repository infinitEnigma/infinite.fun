import { useState } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';
import { getUsdc } from '@/onchain-facts';
import { Tooltip } from './Tooltip';

const BONDING_CURVE_ABI = [
  { name: 'buyTokens',   type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'usdcIn', type: 'uint256' }, { name: 'minTokensOut', type: 'uint256' }],
    outputs: [{ name: 'tokensOut', type: 'uint256' }] },
  { name: 'sellTokens',  type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'tokensIn', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }],
    outputs: [{ name: 'usdcOut', type: 'uint256' }] },
  { name: 'getTokensOut', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'usdcIn', type: 'uint256' }],
    outputs: [{ name: 'tokensOut', type: 'uint256' }] },
  { name: 'getPrice',    type: 'function', stateMutability: 'view',
    inputs: [], outputs: [{ name: 'price', type: 'uint256' }] },
] as const;

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const;

interface Props {
  curveAddress: `0x${string}`;
  tokenAddress: `0x${string}`;
  chainId: number;
}

export function BuySellPanel({ curveAddress, tokenAddress, chainId }: Props) {
  const { address } = useAccount();
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'swapping'>('idle');
  const { writeContract, data: txHash } = useWriteContract();

  const usdc = getUsdc(chainId);
  const usdcDecimals = usdc?.decimals ?? 6;
  const usdcIn = amount ? parseUnits(amount, usdcDecimals) : 0n;

  const { data: quotedTokens } = useReadContract({
    address: curveAddress, abi: BONDING_CURVE_ABI, functionName: 'getTokensOut',
    args: [usdcIn],
    query: { enabled: tab === 'buy' && usdcIn > 0n, refetchInterval: 5000 },
  });
  const { data: price } = useReadContract({
    address: curveAddress, abi: BONDING_CURVE_ABI, functionName: 'getPrice',
    query: { refetchInterval: 5000 },
  });
  const { isLoading: waitingTx } = useWaitForTransactionReceipt({
    hash: txHash, query: { enabled: !!txHash },
  });

  const feeEstimate = amount ? (parseFloat(amount) * 0.01).toFixed(4) : '0';
  const priceDisplay = price ? `$${parseFloat(formatUnits(price, 18)).toExponential(4)}` : '—';
  const tickerTag = `0x${tokenAddress.slice(2, 6).toUpperCase()}`;

  const handleBuy = () => {
    if (!address || !amount || !usdc) return;
    setStep('approving');
    try {
      writeContract({
        address: usdc.address as `0x${string}`,
        abi: ERC20_ABI, functionName: 'approve',
        args: [curveAddress, usdcIn],
      });
      toast.info('Step 1: approve USDC spend in your wallet');
      setStep('swapping');
    } catch {
      toast.error('Transaction cancelled');
      setStep('idle');
    }
  };

  const handleSell = () => {
    if (!address || !amount) return;
    setStep('swapping');
    try {
      const tokensIn = parseUnits(amount, 18);
      writeContract({
        address: curveAddress, abi: BONDING_CURVE_ABI, functionName: 'sellTokens',
        args: [tokensIn, 0n],
      });
      toast.info('Confirm sell in your wallet');
    } catch {
      toast.error('Transaction cancelled');
      setStep('idle');
    }
  };

  const busy = step !== 'idle' || waitingTx;

  return (
    <div
      className="p-4 rounded-2xl border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-4"
        style={{ background: 'var(--surface-muted)' }}
      >
        {(['buy', 'sell'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(''); setStep('idle'); }}
            className="flex-1 py-2 rounded-lg text-sm font-bold transition-all"
            style={{
              background: tab === t
                ? t === 'buy' ? 'rgba(109,217,143,0.15)' : 'rgba(240,107,120,0.15)'
                : 'transparent',
              color: tab === t
                ? t === 'buy' ? 'var(--success)' : 'var(--danger)'
                : 'var(--subtle)',
              border: tab === t
                ? `1px solid ${t === 'buy' ? 'rgba(109,217,143,0.25)' : 'rgba(240,107,120,0.25)'}`
                : '1px solid transparent',
            }}
          >
            {t === 'buy' ? '↑ Buy' : '↓ Sell'}
          </button>
        ))}
      </div>

      {/* Price */}
      <div className="flex justify-between text-xs mb-4 px-1">
        <Tooltip text="Current token price on the bonding curve (xy=k). Price increases as more tokens are bought.">
          <span className="underline decoration-dotted underline-offset-2 cursor-help" style={{ color: 'var(--subtle)' }}>
            Spot price
          </span>
        </Tooltip>
        <span className="mono font-medium" style={{ color: 'var(--ink-2)' }}>{priceDisplay} / token</span>
      </div>

      {/* Amount input */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl border mb-3 transition-all focus-within:border-[var(--accent)]"
        style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
      >
        <input
          type="number" min="0" placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-transparent text-lg font-bold mono outline-none"
          style={{ color: 'var(--ink)' }}
        />
        <span
          className="text-sm font-semibold px-2 py-0.5 rounded-lg flex-shrink-0"
          style={{ background: 'var(--surface-strong)', color: 'var(--accent)' }}
        >
          {tab === 'buy' ? 'USDC' : tickerTag}
        </span>
      </div>

      {/* Fee + output estimate */}
      {amount && (
        <div
          className="text-xs space-y-1.5 mb-4 px-3 py-3 rounded-xl"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <div className="flex justify-between">
            <Tooltip text="1% flat fee on every buy and sell. Goes into SubWallet for perp + burns.">
              <span className="underline decoration-dotted underline-offset-2 cursor-help" style={{ color: 'var(--subtle)' }}>
                Protocol fee (1%)
              </span>
            </Tooltip>
            <span className="mono" style={{ color: 'var(--muted)' }}>
              {tab === 'buy' ? `${feeEstimate} USDC` : `${feeEstimate} tokens`}
            </span>
          </div>
          {tab === 'buy' && quotedTokens !== undefined && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--subtle)' }}>You receive ~</span>
              <span className="mono font-semibold" style={{ color: 'var(--success)' }}>
                {parseFloat(formatUnits(quotedTokens, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} tokens
              </span>
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => { void (tab === 'buy' ? handleBuy() : handleSell()); }}
        disabled={!address || !amount || busy}
        className="w-full py-3 rounded-xl text-sm font-bold btn-glow transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: tab === 'buy'
            ? 'rgba(109,217,143,0.15)'
            : 'rgba(240,107,120,0.15)',
          color: tab === 'buy' ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${tab === 'buy' ? 'rgba(109,217,143,0.25)' : 'rgba(240,107,120,0.25)'}`,
        }}
      >
        {!address ? 'Connect wallet to trade'
          : busy ? (
            <span className="flex items-center justify-center gap-2">
              <span
                className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'currentColor', borderTopColor: 'transparent' }}
              />
              Confirming…
            </span>
          )
          : tab === 'buy' ? `Buy tokens` : `Sell tokens`}
      </button>

      {/* Disclaimer */}
      <p className="text-xs text-center mt-3" style={{ color: 'var(--subtle)', opacity: 0.6 }}>
        xy=k bonding curve · 1% fee · no slippage protection on sell
      </p>
    </div>
  );
}
