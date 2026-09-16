import { useEffect, useState } from 'react';
import { api, type KeeperEvent } from '../api';

const EVENT_META: Record<string, { label: string; icon: string; color: string; bg: string; tip: string }> = {
  fee_claimed:     { label: 'Fee claimed',     icon: '💰', color: 'var(--accent)',  bg: 'rgba(122,173,223,0.08)',  tip: 'Keeper pulled accumulated fees from the bonding curve' },
  margin_added:    { label: 'Margin added',    icon: '➕', color: 'var(--ink-2)',   bg: 'var(--surface-muted)',   tip: 'USDC added to the Hyperliquid position as margin' },
  profit_taken:    { label: 'Profit taken',    icon: '📈', color: 'var(--success)', bg: 'rgba(109,217,143,0.07)', tip: 'Keeper took a 25% profit slice and routed PnL' },
  buyback_burned:  { label: 'Buyback burned',  icon: '🔥', color: 'var(--success)', bg: 'rgba(109,217,143,0.07)', tip: 'USDC used to buy tokens on the curve and burn them' },
  position_opened: { label: 'Position opened', icon: '🚀', color: '#7dd3fc',        bg: 'rgba(125,211,252,0.07)', tip: 'First perp position opened on Hyperliquid' },
  graduated:       { label: 'Graduated',       icon: '🎓', color: 'var(--warn)',    bg: 'rgba(240,201,107,0.07)', tip: 'Bonding curve hit threshold — liquidity migrated to Uniswap' },
};

interface Props { coinAddress: string; }

export function KeeperLog({ coinAddress }: Props) {
  const [events, setEvents] = useState<KeeperEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { events: e } = await api.getEvents(coinAddress, 40);
        if (!cancelled) setEvents(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [coinAddress]);

  if (loading) {
    return (
      <div className="space-y-1.5">
        {[1,2,3].map((i) => (
          <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--surface-muted)' }} />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div
        className="text-center py-10 rounded-xl"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
      >
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--subtle)' }}>
          No keeper events yet. The first event appears once $20 fees have accrued.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {events.map((e) => {
        const meta = EVENT_META[e.event_type] ?? {
          label: e.event_type, icon: '•', color: 'var(--muted)', bg: 'var(--surface-muted)', tip: '',
        };
        return (
          <div
            key={e.id}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-opacity hover:opacity-90"
            style={{ background: meta.bg, border: '1px solid var(--border)', color: meta.color }}
            title={meta.tip}
          >
            <div className="flex items-center gap-2">
              <span>{meta.icon}</span>
              <span className="font-semibold">{meta.label}</span>
              {e.tx_hash && (
                <a
                  href={`https://explorer.testnet.arc.io/tx/${e.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-50 hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--accent)' }}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  ↗
                </a>
              )}
            </div>
            <div className="flex items-center gap-3 font-mono">
              {e.usdc_amount && (
                <span className="font-semibold">${parseFloat(e.usdc_amount).toFixed(3)}</span>
              )}
              <span style={{ color: 'var(--subtle)', opacity: 0.8 }}>
                {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
