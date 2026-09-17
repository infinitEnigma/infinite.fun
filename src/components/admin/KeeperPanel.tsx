import { useState } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { isAddress } from 'viem';
import contracts from '../../contracts.json';

const PT_ABI = [
  { name: 'keeper',    type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'address' }] },
  { name: 'setKeeper', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newKeeper', type: 'address' }], outputs: [] },
] as const;

const FACTORY_ABI = [
  { name: 'keeper',    type: 'function', stateMutability: 'view',       inputs: [], outputs: [{ type: 'address' }] },
  { name: 'setKeeper', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newKeeper', type: 'address' }], outputs: [] },
] as const;

const PT_ADDR      = contracts.platformTreasury  as `0x${string}`;
const FACTORY_ADDR = contracts.launchpadFactory  as `0x${string}`;

export function KeeperPanel() {
  const [newKeeper, setNewKeeper] = useState('');
  const [target, setTarget]       = useState<'treasury' | 'factory'>('treasury');

  const { data: ptKeeper,      refetch: r1 } = useReadContract({ address: PT_ADDR,      abi: PT_ABI,      functionName: 'keeper' });
  const { data: factoryKeeper, refetch: r2 } = useReadContract({ address: FACTORY_ADDR, abi: FACTORY_ABI, functionName: 'keeper' });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess }     = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || isConfirming;

  if (isSuccess) { void r1(); void r2(); }

  function handleRotate() {
    if (!isAddress(newKeeper)) return;
    const addr = newKeeper;
    if (target === 'treasury') {
      writeContract({ address: PT_ADDR,      abi: PT_ABI,      functionName: 'setKeeper', args: [addr] });
    } else {
      writeContract({ address: FACTORY_ADDR, abi: FACTORY_ABI, functionName: 'setKeeper', args: [addr] });
    }
  }

  return (
    <div className="space-y-6">
      {/* Current addresses */}
      <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink-2)' }}>Current Keeper Addresses</div>
        {[
          { label: 'PlatformTreasury.keeper', addr: ptKeeper      as string | undefined },
          { label: 'LaunchpadFactory.keeper', addr: factoryKeeper as string | undefined },
        ].map(({ label, addr }) => (
          <div key={label} className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
            <span className="mono text-xs break-all" style={{ color: 'var(--accent)' }}>{addr ?? '—'}</span>
          </div>
        ))}
        <p className="text-xs leading-relaxed pt-1" style={{ color: 'var(--subtle)' }}>
          The keeper is the hot EOA that signs keeper tick transactions. It has no access to treasury funds.
          You can rotate it without disrupting the protocol — the keeper script picks up the new address on its next tick.
        </p>
      </div>

      {/* Rotate form */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--ink-2)' }}>Rotate Keeper</div>

        <div className="flex gap-2 flex-wrap">
          {(['treasury', 'factory'] as const).map(t => (
            <button key={t} onClick={() => setTarget(t)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: target === t ? 'var(--accent)'        : 'var(--surface-muted)',
                color:      target === t ? '#0d1b2f'              : 'var(--muted)',
                border:     `1px solid ${target === t ? 'transparent' : 'var(--border)'}`,
              }}>
              {t === 'treasury' ? 'PlatformTreasury' : 'LaunchpadFactory'}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--subtle)' }}>New keeper address</label>
          <input value={newKeeper} onChange={e => setNewKeeper(e.target.value)} placeholder="0x…"
            className="w-full mono text-sm rounded-lg px-3 py-2 outline-none"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
        </div>

        <button onClick={handleRotate} disabled={busy || !isAddress(newKeeper)}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#0d1b2f' }}>
          {busy ? 'Confirming…' : `Rotate ${target === 'treasury' ? 'Treasury' : 'Factory'} Keeper`}
        </button>

        {isSuccess && (
          <p className="text-xs" style={{ color: 'var(--success)' }}>
            ✓ Keeper rotated. Update KEEPER_ADDRESS in your server .env and restart the keeper process.
          </p>
        )}

        <div className="rounded-lg p-3 text-xs leading-relaxed"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.15)', color: '#fbbf24' }}>
          Note: setKeeper on both contracts is keeper-only (not owner-only).
          If the keeper key is lost, you must use the emergency path defined in the contract upgrade process.
        </div>
      </div>
    </div>
  );
}
