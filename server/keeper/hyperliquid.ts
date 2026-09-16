/**
 * Hyperliquid keeper client.
 *
 * On mainnet the Hyperliquid bridge contract lives on Arbitrum; for testnet
 * it uses a separate endpoint. All bridge interactions in this keeper are
 * read-only (P&L polling) — on-chain writes go through the SubWallet contract
 * via the keeper EOA calling SubWallet.addMargin / takeProfitSlice.
 *
 * The read API (info endpoint) returns position data by address.
 */

export interface HyperliquidPosition {
  coin: string;
  szi: string;       // position size (signed)
  entryPx: string;   // entry price
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  leverage: { type: string; value: number };
  marginUsed: string;
  maxLeverage: number;
}

const HL_API = process.env.HYPERLIQUID_API_URL ?? 'https://api.hyperliquid-testnet.xyz/info';

export async function getPositions(walletAddress: string): Promise<HyperliquidPosition[]> {
  const res = await fetch(HL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'clearinghouseState', user: walletAddress }),
  });
  if (!res.ok) throw new Error(`[hl] getPositions HTTP ${res.status}`);
  const data = await res.json() as { assetPositions?: { position: HyperliquidPosition }[] };
  return (data.assetPositions ?? []).map((ap) => ap.position);
}

export async function getPosition(
  walletAddress: string,
  market: string
): Promise<HyperliquidPosition | null> {
  const positions = await getPositions(walletAddress);
  return positions.find((p) => p.coin.toLowerCase() === market.toLowerCase()) ?? null;
}
