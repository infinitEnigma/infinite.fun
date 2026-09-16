/**
 * Typed API client for the infinite.fun Express backend.
 * All reads go through /api/* — proxied by Vite in dev, served by nginx in prod.
 */

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API POST ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

// ---- Types ----

export interface Coin {
  address: string;
  name: string;
  ticker: string;
  description: string | null;
  image_url: string | null;
  creator: string;
  market: string;
  leverage: number;
  fee_dest: string;
  burn_mode: boolean;
  sub_wallet: string;
  curve: string;
  launched_at: string;
  graduated_at: string | null;
  graduation_pool: string | null;
  total_fees_claimed: string | null;
  total_burned: string | null;
  total_pnl: string | null;
}

export interface FeedCoin extends Coin {
  latest_pnl: string | null;
  latest_collateral: string | null;
  latest_mark_price: string | null;
  latest_snapshot_at: string | null;
}

export interface KeeperEvent {
  id: number;
  coin_address: string;
  event_type: string;
  usdc_amount: string | null;
  tokens_amount: string | null;
  tx_hash: string | null;
  block_number: number | null;
  created_at: string;
}

export interface PositionSnapshot {
  id: number;
  coin_address: string;
  collateral: string;
  position_size: string;
  entry_price: string;
  mark_price: string;
  unrealized_pnl: string;
  snapshotted_at: string;
}

export interface LeaderboardEntry {
  address: string;
  name: string;
  ticker: string;
  image_url: string | null;
  market: string;
  leverage: number;
  total_fees_claimed: string;
  total_burned: string;
  total_pnl: string;
  updated_at: string;
}

// ---- API calls ----

export const api = {
  feed: (params?: { page?: number; market?: string; graduated?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.market) qs.set('market', params.market);
    if (params?.graduated !== undefined) qs.set('graduated', String(params.graduated));
    return get<{ coins: FeedCoin[]; page: number; limit: number }>(
      `/feed${qs.toString() ? `?${qs}` : ''}`
    );
  },

  getCoin: (address: string) =>
    get<{ coin: Coin }>(`/coins/${address}`),

  createCoin: (data: {
    address: string; name: string; ticker: string; description?: string;
    imageUrl?: string; creator: string; market: string; leverage: number;
    feeDest: string; burnMode: boolean; subWallet: string; curve: string;
  }) => post<{ ok: boolean }>('/coins', data),

  getEvents: (address: string, limit = 50) =>
    get<{ events: KeeperEvent[] }>(`/coins/${address}/events?limit=${limit}`),

  getSnapshots: (address: string, limit = 100) =>
    get<{ snapshots: PositionSnapshot[] }>(`/coins/${address}/snapshots?limit=${limit}`),

  leaderboard: (sort: 'pnl' | 'burned' | 'fees' = 'pnl', limit = 20) =>
    get<{ leaderboard: LeaderboardEntry[] }>(`/leaderboard?sort=${sort}&limit=${limit}`),

  uploadImage: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('Image upload failed');
    const { url } = await res.json() as { url: string };
    return url;
  },
};
