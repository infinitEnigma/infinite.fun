import { useEffect, useState } from 'react';
import { api, type KeeperEvent } from '../api';

const EVENT_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  fee_claimed:     { label: 'Fee claimed',     color: 'var(--accent)',   bg: '#0e2340' },
  margin_added:    { label: 'Margin added',    color: 'var(--ink-2)',    bg: 'var(--surface-muted)' },
  profit_taken:    { label: 'Profit taken',    color: 'var(--success)',  bg: '#1a4a2e' },
  buyback_burned:  { label: 'Buyback burned',  color: 'var(--success)',  bg: '#1a4a2e' },
  position_opened: { label: 'Position opened', color: '#7dd3fc',         bg: '#0c2a44' },
  graduated:       { label: 'Graduated',       color: '#fde68a',         bg: '#3b2a00' },
};

interface Props {
  coinAddress: string;
}

export function KeeperLog({ coinAddress }: Props) {
  const [events, setEvents] = useState<KeeperEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { events: e } = await api.getEvents(coinAddress, 30);
        if (!cancelled) setEvents(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [coinAddress]);

  if (loading) return <div className="animate-pulse h-20 rounded-xl" style={{ background: 'var(--surface)' }} />;
  if (!events.length) return (
    <p className="text-sm" style={{ color: 'var(--subtle)' }}>No keeper events yet.</p>
  );

  return (
    <div className="space-y-1.5">
      {events.map((e) => {
        const style = EVENT_STYLES[e.event_type] ?? { label: e.event_type, color: 'var(--muted)', bg: 'var(--surface-muted)' };
        return (
          <div
            key={e.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
            style={{ background: style.bg, color: style.color }}
          >
            <span className="font-medium">{style.label}</span>
            <div className="flex items-center gap-3">
              {e.usdc_amount && (
                <span className="mono">${parseFloat(e.usdc_amount).toFixed(2)}</span>
              )}
              <span style={{ color: 'var(--subtle)' }}>
                {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
