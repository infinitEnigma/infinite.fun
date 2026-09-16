const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

export async function notify(message: string): Promise<void> {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
  } catch (err) {
    console.error('[notify] Discord webhook failed:', err);
  }
}

export function formatCoinAlert(
  ticker: string,
  coinAddress: string,
  eventType: 'graduated' | 'profit_taken' | 'near_liquidation',
  detail?: string
): string {
  const explorerBase = process.env.EXPLORER_BASE_URL ?? 'https://explorer.testnet.arc.io';
  const url = `${explorerBase}/address/${coinAddress}`;
  const icons: Record<string, string> = {
    graduated: '🎓',
    profit_taken: '💰',
    near_liquidation: '⚠️',
  };
  const labels: Record<string, string> = {
    graduated: 'Graduated',
    profit_taken: 'Profit taken',
    near_liquidation: 'Near liquidation',
  };
  return `${icons[eventType]} **$${ticker}** — ${labels[eventType]}${detail ? ` — ${detail}` : ''}\n${url}`;
}
