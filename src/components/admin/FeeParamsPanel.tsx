import { useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import contracts from '../../contracts.json';

const PT_ABI = [
  { name: 'launchFee',         type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'platformFeeBps',    type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'setLaunchFee',      type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newFee', type: 'uint256' }],  outputs: [] },
  { name: 'setPlatformFeeBps', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newBps', type: 'uint256' }], outputs: [] },
] as const;

const ADDR = contracts.platformTreasury as `0x${string}`;

export function FeeParamsPanel() {
  const { data: launchFeeRaw,   refetch: r1 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'launchFee' });
  const { data: platformBpsRaw, refetch: r2 } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'platformFeeBps' });

  const [newLaunchFee, setNewLaunchFee]       = useState('');
  const [newPlatformBps, setNewPlatformBps]   = useState('');

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess }     = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || isConfirming;

  if (isSuccess) { void r1(); void r2(); }

  const launchFeeDisplay  = launchFeeRaw   !== undefined ? Number(formatUnits(launchFeeRaw, 6)).toFixed(2)  : '—';
  const platformBps       = platformBpsRaw !== undefined ? Number(platformBpsRaw) : null;
  const platformPctDisplay = platformBps  !== null        ? (platformBps / 100).toFixed(2) : '—';

  return (
    <div className="space-y-6">
      {/* Current values */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Launch Fee',        value: launchFeeRaw  !== undefined ? `$${launchFeeDisplay} USDC` : '—', sub: 'Flat fee per coin launch' },
          { label: 'Platform Swap Fee', value: platformBps   !== null      ? `${platformPctDisplay}%`    : '—', sub: `${platformBps ?? '—'} basis points` },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-xs mb-1"  style={{ color: 'var(--subtle)' }}>{label}</div>
            <div className="text-2xl font-bold display" style={{ color: 'var(--ink)' }}>{value}</div>
            <div className="text-xs mt-1"  style={{ color: 'var(--subtle)' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Launch fee editor */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--ink-2)' }}>Update Launch Fee</div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
          Flat USDC amount charged to coin creators on each launch. Set 0 to waive entirely.
          Governable by owner — paste community vote result here.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs block mb-1" style={{ color: 'var(--subtle)' }}>New fee (USDC)</label>
            <input value={newLaunchFee} onChange={e => setNewLaunchFee(e.target.value)}
              placeholder={launchFeeDisplay} type="number" min="0"
              className="w-full mono text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>
          <button
            onClick={() => writeContract({ address: ADDR, abi: PT_ABI, functionName: 'setLaunchFee', args: [parseUnits(newLaunchFee || '0', 6)] })}
            disabled={busy || !newLaunchFee}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0d1b2f' }}>
            {busy ? '…' : 'Set'}
          </button>
        </div>
      </div>

      {/* Platform bps editor */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--ink-2)' }}>Update Platform Swap Fee</div>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
          Basis points deducted from every bonding curve swap and pushed to this treasury.
          Max 100 bps (1%). Default 20 bps = 0.20%.
        </p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs block mb-1" style={{ color: 'var(--subtle)' }}>New fee (bps, 0–100)</label>
            <input value={newPlatformBps} onChange={e => setNewPlatformBps(e.target.value)}
              placeholder={platformBps !== null ? String(platformBps) : '20'}
              type="number" min="0" max="100"
              className="w-full mono text-sm rounded-lg px-3 py-2 outline-none"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
          </div>
          <button
            onClick={() => writeContract({ address: ADDR, abi: PT_ABI, functionName: 'setPlatformFeeBps', args: [BigInt(newPlatformBps || '0')] })}
            disabled={busy || !newPlatformBps || Number(newPlatformBps) > 100}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0d1b2f' }}>
            {busy ? '…' : 'Set'}
          </button>
        </div>
        {isSuccess && <p className="text-xs" style={{ color: 'var(--success)' }}>✓ Updated on-chain</p>}
      </div>
    </div>
  );
}
