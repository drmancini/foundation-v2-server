# Foundation v3 — Database Design

## Overview

Single PostgreSQL 16+ instance with:
- **Connection pooling** via pg-pool (replaces v2's single pg.Client)
- **Parameterized queries** ($1, $2) throughout (replaces v2's string interpolation)
- **NUMERIC types** for all financial data (replaces v2's FLOAT)
- **Partitioned archive** table for share history
- **Version-controlled migrations** via node-pg-migrate with TypeScript migration files
- **Schema-per-pool** namespace (preserved from v2: `"raptoreum".current_blocks`)

---

## Schema Changes from v2

| Change | v2 | v3 | Rationale |
|---|---|---|---|
| Financial types | FLOAT | NUMERIC(20,8) | Eliminates floating-point rounding in balances |
| Query construction | String interpolation | Parameterized ($1, $2) | SQL injection prevention, prepared statement caching |
| Connections | Single pg.Client | pg-pool (2–20 connections) | Concurrent queries, resilience |
| Schema management | Runtime CREATE IF NOT EXISTS | node-pg-migrate (TypeScript files) | Reversible, version-controlled |
| Share archive | None (shares deleted) | Partitioned append-only table | Full replayability |
| Worker local DB | Separate PostgreSQL | Eliminated (SQLite WAL in Rust stratum) | Simplified architecture |
| Primary/Auxiliary | Separate code paths | Single parameterized path | Code deduplication |

---

## Complete Table Catalog

### 1. share_archive (NEW — Append-Only)

The immutable source of truth. Every raw share received via gRPC is written here before processing.

```sql
CREATE TABLE share_archive (
    uuid            UUID            NOT NULL,
    timestamp       BIGINT          NOT NULL,
    submitted       BIGINT          NOT NULL,
    miner           VARCHAR(128)    NOT NULL,
    worker          VARCHAR(128)    NOT NULL DEFAULT 'default',
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    ip_hash         VARCHAR(64)     NOT NULL,
    port            INT             NOT NULL,
    share_diff      NUMERIC(20,8)   NOT NULL,
    block_diff      NUMERIC(20,8)   NOT NULL,
    client_diff     NUMERIC(20,8)   NOT NULL,
    height          INT             NOT NULL,
    reward          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hash            VARCHAR(128),
    transaction     VARCHAR(128),
    valid           BOOLEAN         NOT NULL DEFAULT true,
    stale           BOOLEAN         NOT NULL DEFAULT false,
    block_valid     BOOLEAN         NOT NULL DEFAULT false,
    error           VARCHAR(64),
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    solo            BOOLEAN         NOT NULL DEFAULT false,
    
    PRIMARY KEY (timestamp, uuid)   -- partition key first for range scans
) PARTITION BY RANGE (timestamp);

-- Indexes on each partition (created automatically)
CREATE INDEX idx_archive_miner ON share_archive (miner, timestamp);
CREATE INDEX idx_archive_height ON share_archive (height);
CREATE INDEX idx_archive_block ON share_archive (block_valid) WHERE block_valid = true;
```

**Partition management** (via pg_partman or manual):
```sql
-- Monthly partitions (auto-created)
CREATE TABLE share_archive_y2026m01 PARTITION OF share_archive
    FOR VALUES FROM (1735689600000) TO (1738368000000);

CREATE TABLE share_archive_y2026m02 PARTITION OF share_archive
    FOR VALUES FROM (1738368000000) TO (1740787200000);
-- ... 

-- Detach and drop old partitions (no cold archive)
ALTER TABLE share_archive DETACH PARTITION share_archive_y2025m12;
DROP TABLE share_archive_y2025m12;
-- Daily pg_dump backups with rotation provide disaster recovery
```

**Data retention:** Partitions older than 3 months are dropped entirely (no cold archive). Daily pg_dump backups with rotation provide disaster recovery.

**Sizing estimate** (1000 shares/sec):
| Period | Rows | Estimated Size |
|---|---|---|
| 1 day | ~86M | ~6 GB |
| 1 month | ~2.6B | ~180 GB |
| 3 months (hot) | ~7.8B | ~540 GB |

---

### 2. current_blocks

Block records — tracks blocks from discovery through confirmation to payout.

```sql
CREATE TABLE current_blocks (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    submitted       BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    worker          VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    category        VARCHAR(16)     NOT NULL DEFAULT 'pending',  -- pending/competing/immature/generate/orphan
    confirmations   INT             NOT NULL DEFAULT -1,
    difficulty      NUMERIC(20,8)   NOT NULL DEFAULT -1,
    hash            VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    height          INT             NOT NULL DEFAULT -1,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    luck            NUMERIC(10,4)   NOT NULL DEFAULT 0,
    reward          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    transaction     VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    
    UNIQUE (hash, coin_type)
);

CREATE INDEX idx_blocks_category ON current_blocks (category, coin_type);
CREATE INDEX idx_blocks_miner ON current_blocks (miner, coin_type);
CREATE INDEX idx_blocks_height ON current_blocks (height, coin_type);
CREATE INDEX idx_blocks_competing ON current_blocks (height, coin_type, category)
    WHERE category IN ('pending', 'competing', 'immature');
```

### 3. current_balances

Per-miner financial state. All amounts in NUMERIC.

```sql
CREATE TABLE current_balances (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    balance         NUMERIC(20,8)   NOT NULL DEFAULT 0,      -- pending payout
    generate        NUMERIC(20,8)   NOT NULL DEFAULT 0,      -- confirmed, not yet mature
    immature        NUMERIC(20,8)   NOT NULL DEFAULT 0,      -- immature block reward
    paid            NUMERIC(20,8)   NOT NULL DEFAULT 0,      -- lifetime total paid
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    
    UNIQUE (miner, coin_type)
);

CREATE INDEX idx_balances_balance ON current_balances (balance, coin_type);
```

**Key operations:**
```sql
-- Payment settlement (atomic)
INSERT INTO current_balances (timestamp, miner, balance, paid, coin_type)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (miner, coin_type) DO UPDATE SET
    timestamp = $1,
    balance = current_balances.balance + $3,   -- negative (deducting)
    paid = current_balances.paid + $4;         -- positive (accumulating)

-- Balance update from block confirmation
INSERT INTO current_balances (timestamp, miner, generate, immature, coin_type)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (miner, coin_type) DO UPDATE SET
    timestamp = $1,
    generate = current_balances.generate + $3,
    immature = current_balances.immature + $4;
```

### 4. current_hashrate

Append-only share work log for hashrate calculation. Cleaned by sliding window.

```sql
CREATE TABLE current_hashrate (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL,
    miner           VARCHAR(128)    NOT NULL,
    worker          VARCHAR(128)    NOT NULL,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    ip_hash         VARCHAR(64)     NOT NULL,
    share           VARCHAR(16)     NOT NULL DEFAULT 'valid',
    solo            BOOLEAN         NOT NULL DEFAULT false,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    work            NUMERIC(20,8)   NOT NULL DEFAULT 0
);

-- Composite indexes for aggregation queries
CREATE INDEX idx_hashrate_miner ON current_hashrate (timestamp, miner, solo, coin_type);
CREATE INDEX idx_hashrate_worker ON current_hashrate (timestamp, worker, ip_hash, solo, coin_type);
CREATE INDEX idx_hashrate_pool ON current_hashrate (timestamp, solo, coin_type);
CREATE INDEX idx_hashrate_cleanup ON current_hashrate (timestamp);
```

### 5. current_metadata

Pool-level aggregate state. One row per (identifier, solo, coin_type) combination.

```sql
CREATE TABLE current_metadata (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    blocks          INT             NOT NULL DEFAULT 0,
    efficiency      NUMERIC(10,4)   NOT NULL DEFAULT 0,
    effort          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    invalid         INT             NOT NULL DEFAULT 0,
    miners          INT             NOT NULL DEFAULT 0,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    stale           INT             NOT NULL DEFAULT 0,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    valid           INT             NOT NULL DEFAULT 0,
    work            NUMERIC(20,8)   NOT NULL DEFAULT 0,
    workers         INT             NOT NULL DEFAULT 0,
    
    UNIQUE (identifier, solo, coin_type)
);
```

### 6. current_miners

Per-miner state. One row per (miner, solo, coin_type).

```sql
CREATE TABLE current_miners (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    efficiency      NUMERIC(10,4)   NOT NULL DEFAULT 0,
    effort          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate_12h    NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate_24h    NUMERIC(20,8)   NOT NULL DEFAULT 0,
    invalid         INT             NOT NULL DEFAULT 0,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    stale           INT             NOT NULL DEFAULT 0,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    valid           INT             NOT NULL DEFAULT 0,
    
    UNIQUE (miner, solo, coin_type)
);
```

### 7. current_network

One row per coin. Upserted on every network state update.

```sql
CREATE TABLE current_network (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    difficulty      NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    height          INT             NOT NULL DEFAULT -1,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    
    UNIQUE (coin_type)
);
```

### 8. current_payments

Lock table for payment processing. Prevents double-processing.

```sql
CREATE TABLE current_payments (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    block_id        BIGINT          NOT NULL,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    
    UNIQUE (block_id, coin_type)
);
```

### 9. worker_score_buckets (NEW — Replaces current_rounds)

Pre-aggregated per-worker scoring data in 5-minute time buckets. Used by the ScoringService for fast PPLNT reward calculation without scanning millions of raw shares. See [06-pplnt-reward-design.md](06-pplnt-reward-design.md).

The `current_rounds` table from v2 is **eliminated entirely** — there are no round boundaries in true PPLNT.

```sql
CREATE TABLE worker_score_buckets (
    bucket_time     BIGINT          NOT NULL,  -- floor(timestamp / 300000) * 300000
    miner           VARCHAR(128)    NOT NULL,
    worker          VARCHAR(128)    NOT NULL,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    solo            BOOLEAN         NOT NULL DEFAULT false,
    total_diff      NUMERIC(30,8)   NOT NULL DEFAULT 0,   -- sum of share_diff
    share_count     INT             NOT NULL DEFAULT 0,
    first_share     BIGINT          NOT NULL,              -- earliest share in bucket
    last_share      BIGINT          NOT NULL,              -- latest share in bucket
    time_score      NUMERIC(30,8)   NOT NULL DEFAULT 0,    -- pre-computed Σ(diff × Δt)
    
    PRIMARY KEY (bucket_time, miner, worker, coin_type, solo)
);

CREATE INDEX idx_wsb_time ON worker_score_buckets (bucket_time, coin_type, solo);
CREATE INDEX idx_wsb_miner ON worker_score_buckets (miner, coin_type, bucket_time);
```

**Key UPSERT (updated incrementally as shares arrive):**
```sql
INSERT INTO worker_score_buckets 
    (bucket_time, miner, worker, coin_type, solo, 
     total_diff, share_count, first_share, last_share, time_score)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9)
ON CONFLICT (bucket_time, miner, worker, coin_type, solo) DO UPDATE SET
    total_diff = worker_score_buckets.total_diff + $6,
    share_count = worker_score_buckets.share_count + $7,
    last_share = GREATEST(worker_score_buckets.last_share, $8),
    time_score = worker_score_buckets.time_score + $9;
```

**Scoring window query (used by ScoringService):**
```sql
-- Get aggregate scores for all miners in the scoring window
SELECT miner, SUM(time_score) AS total_score, SUM(share_count) AS shares
FROM worker_score_buckets
WHERE bucket_time BETWEEN $1 AND $2      -- window bounds
  AND coin_type = $3
  AND solo = false
GROUP BY miner
ORDER BY total_score DESC;
```

With 5-minute buckets, this query touches ~24 rows per miner for a 2-hour window, vs millions of raw share rows.

**Retention:** Buckets older than `scoring_window + 1 day` are pruned periodically.

### 10. block_scores (NEW — Replaces historical_rounds)

Stores the computed PPLNT payout distribution for each confirmed block. Created at `generate` time when the ScoringService computes the reward distribution. Immutable after creation.

```sql
CREATE TABLE block_scores (
    id              BIGSERIAL       PRIMARY KEY,
    block_id        BIGINT          NOT NULL,
    miner           VARCHAR(128)    NOT NULL,
    score           NUMERIC(30,8)   NOT NULL,     -- raw time×work score
    share           NUMERIC(10,8)   NOT NULL,     -- fraction of total (0.0–1.0)
    amount          NUMERIC(20,8)   NOT NULL,     -- reward amount for this miner
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    window_start    BIGINT          NOT NULL,     -- scoring window start timestamp
    window_end      BIGINT          NOT NULL,     -- = block submitted timestamp
    
    UNIQUE (block_id, miner, coin_type)
);

CREATE INDEX idx_block_scores_block ON block_scores (block_id);
CREATE INDEX idx_block_scores_miner ON block_scores (miner, coin_type);
```

### 11. current_transactions

Lock table for block processing. Prevents double-processing across services.

```sql
CREATE TABLE current_transactions (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    block_id        BIGINT          NOT NULL,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    
    UNIQUE (block_id, coin_type)
);
```

### 12. current_users

Miner preferences and settings.

```sql
CREATE TABLE current_users (
    id                      BIGSERIAL       PRIMARY KEY,
    timestamp               BIGINT          NOT NULL DEFAULT -1,
    miner                   VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    activity_limit          INT             NOT NULL DEFAULT 0,
    activity_notifications  BOOLEAN         NOT NULL DEFAULT false,
    consent                 BOOLEAN         NOT NULL DEFAULT false,
    email                   VARCHAR(256)    NOT NULL DEFAULT 'unknown',
    joined                  BIGINT          NOT NULL DEFAULT -1,
    locale                  VARCHAR(16)     NOT NULL DEFAULT 'unknown',
    payment_notifications   BOOLEAN         NOT NULL DEFAULT false,
    payout_limit            NUMERIC(20,8)   NOT NULL DEFAULT 0,  -- NUMERIC (was INT in v2)
    subscribed              BOOLEAN         NOT NULL DEFAULT false,
    token                   VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    coin_type               VARCHAR(16)     NOT NULL DEFAULT 'unknown',
    
    UNIQUE (miner, coin_type)
);

CREATE INDEX idx_users_notifications ON current_users (activity_notifications, subscribed);
CREATE INDEX idx_users_token ON current_users (miner, token);
CREATE INDEX idx_users_payout ON current_users (miner, payout_limit);
```

### 13. current_workers

Per-worker state with connection metadata.

```sql
CREATE TABLE current_workers (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    worker          VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    efficiency      NUMERIC(10,4)   NOT NULL DEFAULT 0,
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate_12h    NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate_24h    NUMERIC(20,8)   NOT NULL DEFAULT 0,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    invalid         INT             NOT NULL DEFAULT 0,
    ip_hash         VARCHAR(64)     NOT NULL DEFAULT 'unknown',
    last_octet      INT             NOT NULL DEFAULT -1,
    last_share      BIGINT          NOT NULL DEFAULT -1,
    offline_tag     BOOLEAN         NOT NULL DEFAULT false,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    stale           INT             NOT NULL DEFAULT 0,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    valid           INT             NOT NULL DEFAULT 0,
    
    UNIQUE (worker, ip_hash, solo, coin_type)
);

CREATE INDEX idx_workers_miner ON current_workers (miner, coin_type);
```

---

### Historical Tables

All historical tables add a `recent` (BIGINT) column for time bucketing.

### 14. historical_blocks
Same columns as `current_blocks`. Append-only archive of completed blocks.

```sql
CREATE TABLE historical_blocks (
    -- Same columns as current_blocks
    id, timestamp, submitted, miner, worker, category, confirmations,
    difficulty, hash, height, identifier, luck, reward, solo,
    transaction, coin_type,
    
    UNIQUE (hash, coin_type)
);
```

### 15. historical_metadata
```sql
CREATE TABLE historical_metadata (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    recent          BIGINT          NOT NULL DEFAULT -1,
    blocks          INT             NOT NULL DEFAULT 0,
    efficiency      NUMERIC(10,4)   NOT NULL DEFAULT 0,
    effort          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    invalid         INT             NOT NULL DEFAULT 0,
    miners          INT             NOT NULL DEFAULT 0,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    stale           INT             NOT NULL DEFAULT 0,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    valid           INT             NOT NULL DEFAULT 0,
    work            NUMERIC(20,8)   NOT NULL DEFAULT 0,
    workers         INT             NOT NULL DEFAULT 0,
    
    UNIQUE (recent, identifier, solo, coin_type)
);
```

### 16. historical_miners
```sql
CREATE TABLE historical_miners (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    recent          BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    invalid         INT             NOT NULL DEFAULT 0,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    stale           INT             NOT NULL DEFAULT 0,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    valid           INT             NOT NULL DEFAULT 0,
    work            NUMERIC(20,8)   NOT NULL DEFAULT 0,
    
    UNIQUE (recent, miner, solo, coin_type)
);

-- 12h/24h rolling average query
CREATE INDEX idx_hist_miners_avg ON historical_miners (miner, solo, coin_type, recent);
```

### 17. historical_network
```sql
CREATE TABLE historical_network (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    recent          BIGINT          NOT NULL DEFAULT -1,
    difficulty      NUMERIC(20,8)   NOT NULL DEFAULT 0,
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    height          INT             NOT NULL DEFAULT -1,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    
    UNIQUE (recent, coin_type)
);
```

### 18. historical_payments
```sql
CREATE TABLE historical_payments (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    amount          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    transaction     VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary'
    
    -- No unique constraint — append-only log
);

CREATE INDEX idx_hist_payments_miner ON historical_payments (miner, coin_type);
CREATE INDEX idx_hist_payments_time ON historical_payments (timestamp);
```

### 19. ~~historical_rounds~~ → block_scores

The v2 `historical_rounds` table is replaced by `block_scores` (table 10 above). Instead of per-round work snapshots based on round boundaries, `block_scores` stores the continuous sliding-window PPLNT scoring result for each confirmed block. Historical payout distributions are fully reconstructible from this table.

### 20. historical_transactions
```sql
CREATE TABLE historical_transactions (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    amount          NUMERIC(20,8)   NOT NULL DEFAULT 0,
    transaction     VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary'
);
```

### 21. historical_workers
```sql
CREATE TABLE historical_workers (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    recent          BIGINT          NOT NULL DEFAULT -1,
    miner           VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    worker          VARCHAR(128)    NOT NULL DEFAULT 'unknown',
    hashrate        NUMERIC(20,8)   NOT NULL DEFAULT 0,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    invalid         INT             NOT NULL DEFAULT 0,
    ip_hash         VARCHAR(64)     NOT NULL DEFAULT 'unknown',
    solo            BOOLEAN         NOT NULL DEFAULT false,
    stale           INT             NOT NULL DEFAULT 0,
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    valid           INT             NOT NULL DEFAULT 0,
    work            NUMERIC(20,8)   NOT NULL DEFAULT 0,
    
    UNIQUE (recent, worker, ip_hash, solo, coin_type)
);

CREATE INDEX idx_hist_workers_avg ON historical_workers (worker, ip_hash, solo, coin_type, recent);
```

### 22. local_history (monitoring)
```sql
CREATE TABLE local_history (
    id              BIGSERIAL       PRIMARY KEY,
    timestamp       BIGINT          NOT NULL DEFAULT -1,
    recent          BIGINT          NOT NULL DEFAULT -1,
    identifier      VARCHAR(64)     NOT NULL DEFAULT 'master',
    share_count     INT             NOT NULL DEFAULT 0,
    share_writes    INT             NOT NULL DEFAULT 0,
    transaction_count INT           NOT NULL DEFAULT 0,
    
    UNIQUE (recent, identifier)
);
```

---

## Column Rename: `type` → `coin_type`

The v2 column named `type` is renamed to `coin_type` in v3. `type` is a reserved word in many contexts and causes confusion. Values remain `'primary'` and `'auxiliary'`.

---

## Query Layer Design

### Parameterized Queries

Every query uses PostgreSQL parameterized syntax:

```typescript
// v2 (DANGEROUS — SQL injection)
const query = `SELECT * FROM blocks WHERE miner = '${miner}' AND type = '${type}'`;

// v3 (SAFE — parameterized)
const query = 'SELECT * FROM current_blocks WHERE miner = $1 AND coin_type = $2';
const values = [miner, coinType];
const result = await pool.query(query, values);
```

### Query Builder

Reusable query builder for API endpoints:

```typescript
interface QueryBuilder {
  select(table: string, columns?: string[]): QueryBuilder;
  where(column: string, operator: string, value: unknown): QueryBuilder;
  whereIn(column: string, values: unknown[]): QueryBuilder;
  orderBy(column: string, direction: 'ASC' | 'DESC'): QueryBuilder;
  limit(n: number): QueryBuilder;
  offset(n: number): QueryBuilder;
  build(): { text: string; values: unknown[] };
}

// Usage
const { text, values } = new QueryBuilder()
  .select('current_blocks')
  .where('coin_type', '=', 'primary')
  .where('category', '=', 'generate')
  .where('height', '>=', 100000)
  .orderBy('timestamp', 'DESC')
  .limit(50)
  .build();
// text: "SELECT * FROM current_blocks WHERE coin_type = $1 AND category = $2 AND height >= $3 ORDER BY timestamp DESC LIMIT $4"
// values: ['primary', 'generate', 100000, 50]
```

### Connection Pool Configuration

```typescript
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
  min: config.database.poolMin,       // 2
  max: config.database.poolMax,       // 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: config.database.statementTimeout,  // 30000
});
```

---

## Migration Strategy

### Initial Migration (v3 fresh install)

Migrations are written as **TypeScript files** (not raw SQL) using node-pg-migrate's programmatic API. This enables type checking, reusable helpers, and consistent formatting:

```
migrations/
├── 001_create_current_blocks.ts
├── 002_create_current_balances.ts
├── 003_create_current_hashrate.ts
├── 004_create_current_metadata.ts
├── 005_create_current_miners.ts
├── 006_create_current_network.ts
├── 007_create_current_payments.ts
├── 008_create_worker_score_buckets.ts
├── 009_create_block_scores.ts
├── 010_create_current_transactions.ts
├── 011_create_current_users.ts
├── 012_create_current_workers.ts
├── 013_create_historical_blocks.ts
├── 014_create_historical_metadata.ts
├── 015_create_historical_miners.ts
├── 016_create_historical_network.ts
├── 017_create_historical_payments.ts
├── 018_create_historical_transactions.ts
├── 019_create_historical_workers.ts
├── 020_create_local_history.ts
├── 021_create_share_archive.ts
└── 022_create_archive_partitions.ts
```

```typescript
// Example: migrations/001_create_current_blocks.ts
import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('current_blocks', {
    id: { type: 'bigserial', primaryKey: true },
    timestamp: { type: 'bigint', notNull: true, default: -1 },
    // ... all columns with proper types
  });
  pgm.createIndex('current_blocks', ['category', 'coin_type']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('current_blocks');
}
```

### Data Migration (v2 → v3)

```sql
-- Example: migrate current_balances (FLOAT → NUMERIC)
INSERT INTO v3_schema.current_balances 
    (timestamp, miner, balance, generate, immature, paid, coin_type)
SELECT 
    timestamp, miner, 
    balance::NUMERIC(20,8), 
    generate::NUMERIC(20,8), 
    immature::NUMERIC(20,8), 
    paid::NUMERIC(20,8),
    type AS coin_type    -- renamed column
FROM v2_schema.current_balances;
```

---

## Performance Considerations

### Indexes

All indexes are designed for the actual query patterns:
- API queries: compound indexes matching `WHERE` + `ORDER BY` columns
- Aggregation queries (statistics): cover grouping columns
- Cleanup queries: index on `timestamp` for range deletes
- Payment queries: index on block_id join columns

### Partitioning

Only `share_archive` is partitioned (by timestamp range, monthly). All other tables remain unpartitioned — they are regularly cleaned up and stay small relative to the archive.

### VACUUM / Maintenance

- `current_hashrate`: high INSERT/DELETE churn → set `autovacuum_vacuum_scale_factor = 0.01`
- `share_archive`: append-only → minimal vacuum needed
- `worker_score_buckets`: moderate UPSERT churn on bucket updates → default autovacuum sufficient

### Prepared Statements

pg-pool with `{ prepare: true }` on frequently-used queries enables PostgreSQL to cache query plans:

```typescript
// Automatically uses prepared statement on repeat calls
await pool.query({
  name: 'insert-hashrate',
  text: 'INSERT INTO current_hashrate (...) VALUES ($1, $2, $3, ...)',
  values: [...]
});
```
