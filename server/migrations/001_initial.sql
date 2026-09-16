-- infinite.fun initial schema
-- Run: psql -U postgres -d infinite_fun -f 001_initial.sql

CREATE TABLE IF NOT EXISTS coins (
    address         TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    ticker          TEXT NOT NULL,
    description     TEXT,
    image_url       TEXT,
    creator         TEXT NOT NULL,
    market          TEXT NOT NULL,
    leverage        INTEGER NOT NULL,
    fee_dest        TEXT NOT NULL,
    burn_mode       BOOLEAN NOT NULL DEFAULT true,
    sub_wallet      TEXT NOT NULL,
    curve           TEXT NOT NULL,
    launched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    graduated_at    TIMESTAMPTZ,
    graduation_pool TEXT
);

CREATE TABLE IF NOT EXISTS keeper_events (
    id              BIGSERIAL PRIMARY KEY,
    coin_address    TEXT NOT NULL REFERENCES coins(address),
    event_type      TEXT NOT NULL CHECK (event_type IN (
                        'fee_claimed','margin_added','profit_taken',
                        'buyback_burned','position_opened','graduated'
                    )),
    usdc_amount     NUMERIC(30, 6),
    tokens_amount   NUMERIC(40, 18),
    tx_hash         TEXT,
    block_number    BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS keeper_events_coin_idx ON keeper_events(coin_address);
CREATE INDEX IF NOT EXISTS keeper_events_created_idx ON keeper_events(created_at DESC);

CREATE TABLE IF NOT EXISTS position_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    coin_address    TEXT NOT NULL REFERENCES coins(address),
    collateral      NUMERIC(30, 6),
    position_size   NUMERIC(30, 6),
    entry_price     NUMERIC(30, 6),
    mark_price      NUMERIC(30, 6),
    unrealized_pnl  NUMERIC(30, 6),
    snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS snapshots_coin_idx ON position_snapshots(coin_address);
CREATE INDEX IF NOT EXISTS snapshots_time_idx  ON position_snapshots(snapshotted_at DESC);

CREATE TABLE IF NOT EXISTS leaderboard_cache (
    coin_address        TEXT PRIMARY KEY REFERENCES coins(address),
    total_fees_claimed  NUMERIC(30, 6) NOT NULL DEFAULT 0,
    total_burned        NUMERIC(40, 18) NOT NULL DEFAULT 0,
    total_pnl           NUMERIC(30, 6) NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
