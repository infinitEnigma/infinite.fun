import { useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, isAddress } from 'viem';
import contracts from '../../contracts.json';

const PT_ABI = [
  { name: 'balance',        type: 'function', stateMutability: 'view',       inputs: [],                                                                       outputs: [{ type: 'uint256' }] },
  { name: 'totalReceived',  type: 'function', stateMutability: 'view',       inputs: [],                                                                       outputs: [{ type: 'uint256' }] },
  { name: 'totalWithdrawn', type: 'function', stateMutability: 'view',       inputs: [],                                                                       outputs: [{ type: 'uint256' }] },
  { name: 'withdraw',       type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],   outputs: [] },
  { name: 'withdrawAll',    type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }],                                        outputs: [] },
] as const;

const ADDR = contracts.platformTreasury as `0x${string}`;

function usdcFmt(raw: bigint | undefined) {
  if (raw === undefined) return '—';
  return `$${Number(formatUnits(raw, 6)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function TreasuryPanel() {
  const [recipient, setRecipient]   = useState('');
  const [amount, setAmount]         = useState('');
  const [withdrawAll, setWithdrawAll] = useState(false);

  const { data: balance,   refetch: r1 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'balance' });
  const { data: received,  refetch: r2 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'totalReceived' });
  const { data: withdrawn, refetch: r3 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'totalWithdrawn' });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess }     = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || isConfirming;

  if (isSuccess) { void r1(); void r2(); void r3(); }

  function handleWithdraw() {
    if (!isAddress(recipient)) return;
    if (withdrawAll) {
      writeContract({ address: ADDR, abi: PT_ABI, functionName: 'withdrawAll', args: [recipient] });
    } else {
      if (!amount) return;
      writeContract({ address: ADDR, abi: PT_ABI, functionName: 'withdraw', args: [recipient, parseUnits(amount, 6)] });
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Current Balance', value: usdcFmt(balance),   accent: true },
          { label: 'Total Received',  value: usdcFmt(received),  accent: false },
          { label: 'Total Withdrawn', value: usdcFmt(withdrawn), accent: false },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--subtle)' }}>{label}</div>
            <div className={`text-2xl font-bold display${accent ? ' text-glow' : ''}`}
              style={{ color: accent ? 'var(--accent-2)' : 'var(--ink)' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Withdraw form */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--ink-2)' }}>Withdraw USDC</div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--subtle)' }}>Recipient address</label>
          <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…"
            className="w-full mono text-sm rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={withdrawAll} onChange={e => setWithdrawAll(e.target.checked)}
            className="accent-[var(--accent)]" />
          Withdraw full balance
        </label>

        {!withdrawAll && (
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--subtle)' }}>Amount (USDC)</label>
            <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="100.00"
              type="number" min="0"
              className="w-full mono text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>
        )}

        <button onClick={handleWithdraw} disabled={busy || !isAddress(recipient)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0d1b2f' }}>
          {busy ? 'Confirming…' : 'Withdraw'}
        </button>

        {isSuccess && <p className="text-xs" style={{ color: 'var(--success)' }}>✓ Withdrawal confirmed</p>}
      </div>
    </div>
  );
}
