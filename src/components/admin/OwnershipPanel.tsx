import { useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from 'wagmi';
import { isAddress } from 'viem';
import contracts from '../../contracts.json';

const PT_ABI = [
  { name: 'owner',             type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'address' }] },
  { name: 'pendingOwner',      type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'address' }] },
  { name: 'transferOwnership', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newOwner', type: 'address' }], outputs: [] },
  { name: 'acceptOwnership',   type: 'function', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

const ADDR = contracts.platformTreasury as `0x${string}`;
const ZERO = '0x0000000000000000000000000000000000000000';

export function OwnershipPanel() {
  const { address: connectedWallet } = useAccount();
  const [newOwner, setNewOwner] = useState('');

  const { data: owner,        refetch: r1 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'owner' });
  const { data: pendingOwner, refetch: r2 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'pendingOwner' });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess }     = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || isConfirming;

  if (isSuccess) { void r1(); void r2(); }

  const po         = pendingOwner as string | undefined;
  const hasPending = po && po !== ZERO;
  const isPendingWallet = hasPending && connectedWallet?.toLowerCase() === po.toLowerCase();

  return (
    <div className="space-y-6">
      {/* State display */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-2)' }}>Ownership State</div>
        {[
          { label: 'Current owner',  value: (owner as string | undefined) ?? '—' },
          { label: 'Pending owner',  value: hasPending ? po : 'None' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-4 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
            <span className="mono text-xs break-all" style={{ color: value === 'None' ? 'var(--subtle)' : 'var(--accent)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Initiate transfer */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--ink-2)' }}>Initiate Ownership Transfer</div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
          Two-step process: propose a new owner here, then the new owner must call Accept Ownership from their wallet.
          The current owner retains full control until acceptance.
        </p>
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--subtle)' }}>New owner address</label>
          <input value={newOwner} onChange={e => setNewOwner(e.target.value)} placeholder="0x…"
            className="w-full mono text-sm rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
        </div>
        <button
          onClick={() => writeContract({ address: ADDR, abi: PT_ABI, functionName: 'transferOwnership', args: [newOwner as `0x${string}`] })}
          disabled={busy || !isAddress(newOwner)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0d1b2f' }}>
          {busy ? 'Confirming…' : 'Initiate Transfer'}
        </button>
      </div>

      {/* Accept ownership */}
      {hasPending && (
        <div className="rounded-xl p-5 space-y-4"
          style={{ background: 'rgba(172,198,233,0.06)', border: '1px solid rgba(172,198,233,0.2)' }}>
          <div className="font-semibold text-sm" style={{ color: 'var(--accent-2)' }}>Accept Ownership</div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            Transfer pending to <span className="mono">{po}</span>.
            {isPendingWallet
              ? ' Your connected wallet is the pending owner — you can accept now.'
              : ' Connect the pending owner wallet to accept.'}
          </p>
          {isPendingWallet && (
            <button
              onClick={() => writeContract({ address: ADDR, abi: PT_ABI, functionName: 'acceptOwnership' })}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--accent-2)', color: '#0d1b2f' }}>
              {busy ? 'Confirming…' : 'Accept Ownership'}
            </button>
          )}
        </div>
      )}

      {isSuccess && <p className="text-xs" style={{ color: 'var(--success)' }}>✓ Transaction confirmed</p>}
    </div>
  );
}
