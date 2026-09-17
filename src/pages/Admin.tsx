import { useState } from 'react';
import { useAccount } from 'wagmi';
import { useReadContract } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import contracts from '../contracts.json';
import { TreasuryPanel }   from '../components/admin/TreasuryPanel';
import { FeeParamsPanel }  from '../components/admin/FeeParamsPanel';
import { CoinsPanel }      from '../components/admin/CoinsPanel';
import { KeeperPanel }     from '../components/admin/KeeperPanel';
import { OwnershipPanel }  from '../components/admin/OwnershipPanel';
import { AnalyticsPanel }  from '../components/admin/AnalyticsPanel';
import { Footer }          from '../components/Footer';
import { useNavigate }     from 'react-router-dom';

const PT_ABI = [
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const ADDR = contracts.platformTreasury as `0x${string}`;

type Tab = 'analytics' | 'treasury' | 'fees' | 'coins' | 'keeper' | 'ownership';

const TABS: { id: Tab; label: string }[] = [
  { id: 'analytics', label: 'Analytics'  },
  { id: 'treasury',  label: 'Treasury'   },
  { id: 'fees',      label: 'Fee Params' },
  { id: 'coins',     label: 'All Coins'  },
  { id: 'keeper',    label: 'Keeper'     },
  { id: 'ownership', label: 'Ownership'  },
];

export function Admin() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>('analytics');

  const { data: ownerAddr } = useReadContract({ address: ADDR, abi: PT_ABI, functionName: 'owner' });

  const owner      = (ownerAddr as string | undefined)?.toLowerCase();
  const isOwner    = isConnected && !!address && address.toLowerCase() === owner;
  const ownerKnown = !!owner;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: 'rgba(8,15,28,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => void navigate('/')} className="display font-bold text-lg text-glow"
            style={{ color: 'var(--accent-2)', background: 'none', border: 'none', cursor: 'pointer' }}>
            ∞<span style={{ color: 'var(--ink)' }}>.fun</span>
          </button>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(172,198,233,0.1)', color: 'var(--accent-2)', border: '1px solid rgba(172,198,233,0.2)' }}>
            Admin
          </span>
        </div>
        <ConnectKitButton />
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Not connected */}
        {!isConnected && (
          <div className="rounded-2xl p-10 text-center space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="text-4xl mb-2">🔒</div>
            <div className="font-semibold text-lg" style={{ color: 'var(--ink)' }}>Connect your wallet</div>
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>
              The admin dashboard requires the owner wallet to be connected for write operations.
            </p>
            <div className="flex justify-center pt-2">
              <ConnectKitButton />
            </div>
          </div>
        )}

        {/* Connected but not owner */}
        {isConnected && ownerKnown && !isOwner && (
          <div className="rounded-2xl p-10 text-center space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div className="text-4xl mb-2">⚠️</div>
            <div className="font-semibold text-lg" style={{ color: '#fbbf24' }}>Owner wallet required for writes</div>
            <p className="text-sm" style={{ color: 'var(--subtle)' }}>
              You are connected as <span className="mono">{address}</span> but the owner is{' '}
              <span className="mono">{ownerAddr as string}</span>.
              Read-only views are shown. Connect the owner wallet to enable write operations.
            </p>
            {/* Still show dashboard in read-only */}
          </div>
        )}

        {/* Dashboard — shown to all connected wallets (owner = write enabled, other = read-only) */}
        {isConnected && (
          <div className="mt-6 space-y-6">
            {/* Owner badge */}
            {isOwner && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg w-fit"
                style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: 'var(--success)' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
                Owner wallet connected — all write operations enabled
              </div>
            )}

            {/* Tab bar */}
            <div className="flex gap-1 flex-wrap rounded-xl p-1" style={{ background: 'var(--surface-muted)' }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 sm:flex-none"
                  style={{
                    background: tab === t.id ? 'var(--surface-strong)' : 'transparent',
                    color:      tab === t.id ? 'var(--ink)'            : 'var(--muted)',
                    boxShadow:  tab === t.id ? '0 1px 4px rgba(0,0,0,0.3)' : 'none',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div>
              {tab === 'analytics' && <AnalyticsPanel />}
              {tab === 'treasury'  && <TreasuryPanel  />}
              {tab === 'fees'      && <FeeParamsPanel  />}
              {tab === 'coins'     && <CoinsPanel      />}
              {tab === 'keeper'    && <KeeperPanel     />}
              {tab === 'ownership' && <OwnershipPanel  />}
            </div>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
