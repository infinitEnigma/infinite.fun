import { useState } from 'react';
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { toast } from 'sonner';
import { getUsdc } from '@/onchain-facts';

const BONDING_CURVE_ABI = [
  {
    name: 'buyTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'usdcIn', type: 'uint256' }, { name: 'minTokensOut', type: 'uint256' }],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  {
    name: 'sellTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokensIn', type: 'uint256' }, { name: 'minUsdcOut', type: 'uint256' }],
    outputs: [{ name: 'usdcOut', type: 'uint256' }],
  },
  {
    name: 'getTokensOut',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'usdcIn', type: 'uint256' }],
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
  },
  {
    name: 'getPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'price', type: 'uint256' }],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
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

  // Quote
  const usdcIn = amount ? parseUnits(amount, usdcDecimals) : 0n;
  const { data: quotedTokens } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: 'getTokensOut',
    args: [usdcIn],
    query: { enabled: tab === 'buy' && usdcIn > 0n, refetchInterval: 5000 },
  });

  const { data: price } = useReadContract({
    address: curveAddress,
    abi: BONDING_CURVE_ABI,
    functionName: 'getPrice',
    query: { refetchInterval: 5000 },
  });

  const { isLoading: waitingTx } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  const feeEstimate = amount ? (parseFloat(amount) * 0.01).toFixed(4) : '0';
  const priceDisplay = price ? `$${parseFloat(formatUnits(price, 18)).toExponential(4)}` : '—';

  const handleBuy = () => {
    if (!address || !amount || !usdc) return;
    setStep('approving');
    try {
      // Step 1: approve USDC
      writeContract({
        address: usdc.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [curveAddress, usdcIn],
      });
      toast.info('Approve USDC spend in your wallet');
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
        address: curveAddress,
        abi: BONDING_CURVE_ABI,
        functionName: 'sellTokens',
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
    <div className="p-4 rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-0.5 rounded-lg" style={{ background: 'var(--surface-muted)' }}>
        {(['buy', 'sell'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setAmount(''); setStep('idle'); }}
            className="flex-1 py-1.5 rounded-md text-sm font-semibold transition-all"
            style={{
              background: tab === t ? 'var(--surface-strong)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--subtle)',
            }}
          >
            {t === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      {/* Price */}
      <div className="flex justify-between text-xs mb-3" style={{ color: 'var(--subtle)' }}>
        <span>Spot price</span>
        <span className="mono">{priceDisplay} / token</span>
      </div>

      {/* Amount input */}
      <div className="mb-3">
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border"
          style={{ background: 'var(--surface-muted)', borderColor: 'var(--border)' }}
        >
          <input
            type="number"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent text-base font-semibold mono outline-none"
            style={{ color: 'var(--ink)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>
            {tab === 'buy' ? 'USDC' : '$' + tokenAddress.slice(2, 6).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Fee + output estimate */}
      {amount && (
        <div className="text-xs space-y-1 mb-4" style={{ color: 'var(--subtle)' }}>
          <div className="flex justify-between">
            <span>Protocol fee (1%)</span>
            <span className="mono">{tab === 'buy' ? `${feeEstimate} USDC` : `${feeEstimate} tokens`}</span>
          </div>
          {tab === 'buy' && quotedTokens !== undefined && (
            <div className="flex justify-between">
              <span>You receive ~</span>
              <span className="mono" style={{ color: 'var(--ink-2)' }}>
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
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
        style={{
          background: 'var(--accent)',
          color: 'var(--bg)',
        }}
      >
        {!address ? 'Connect wallet' : busy ? 'Confirming…' : tab === 'buy' ? 'Buy tokens' : 'Sell tokens'}
      </button>
    </div>
  );
}
