# Foundation v3 — Core Server Specification

## Overview

`foundation-core` is the pool management server written in TypeScript. It handles everything after share validation: ingestion, block tracking, PPLNT scoring, payments, statistics, and the public REST API with SSE push events.

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    foundation-core                       │
│                                                         │
│  ┌──────────────┐                                       │
│  │ gRPC Server  │──── SubmitShares ──┐                  │
│  │ (port 50051) │──── SubmitBlock  ──┤                  │
│  │              │──── ReportNetwork ─┤                  │
│  └──────────────┘                    │                  │
│                                      ▼                  │
│                              ┌──────────────┐           │
│                              │ Ingestion    │           │
│                              │ Service      │           │
│                              └──────┬───────┘           │
│                                     │                   │
│                    ┌────────────────┤                   │
│                    ▼                ▼                   │
│           ┌──────────────┐  ┌──────────────┐           │
│           │ Archive      │  │ Processing   │           │
│           │ Writer       │  │ Dispatcher   │           │
│           │ (append-only)│  │              │           │
│           └──────────────┘  └──────┬───────┘           │
│                                    │                   │
│              ┌─────────┬───────────┼─────────┐         │
│              ▼         ▼           ▼         ▼         │
│      ┌───────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│      │ Scoring   │ │ Block  │ │Payment │ │  Stats │   │
│      │ Service   │ │Service │ │Service │ │Service │   │
│      └───────────┘ └────────┘ └────────┘ └────────┘   │
│                                                         │
│  ┌──────────────┐  ┌──────────────────────────────┐    │
│  │ REST API     │  │ PostgreSQL                   │    │
│  │ (Fastify)    │  │ (pg-pool, TypeScript          │    │
│  │ + SSE push   │  │  migrations, parameterized    │    │
│  │ (port 3001)  │  │  queries)                     │    │
│  └──────────────┘  └──────────────────────────────┘    │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ Replay CLI   │  │ Email/SMTP   │                    │
│  └──────────────┘  │ Notifications│                    │
│                     └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### 1. Ingestion Service (`src/grpc/`)

Receives shares and blocks from stratum servers via gRPC.

```typescript
interface IngestionService {
  // gRPC handlers
  submitShares(batch: ShareBatch): Promise<ShareAck>;
  submitBlock(block: BlockFound): Promise<BlockAck>;
  reportNetwork(state: NetworkState): Promise<Empty>;
}
```

**Flow for `submitShares`:**

```
1. Validate batch (UUIDs present, required fields non-null)
2. Begin database transaction
3. INSERT all shares into share_archive (append-only, ON CONFLICT DO NOTHING)
4. Dispatch shares to IngestionPipeline for processing
5. COMMIT transaction
6. Return ShareAck with accepted UUIDs
```

**Key behaviors:**
- Idempotent: duplicate UUIDs are silently ignored (ON CONFLICT DO NOTHING)
- Atomic: archive write + processing dispatch in one transaction
- Back-pressure: if core can't keep up, gRPC flow control slows the stratum forwarder
- Auth: server TLS + bearer token (shared secret in gRPC metadata)

### 2. Ingestion Pipeline (`src/services/ingestion.ts`)

Replaces the current `rounds.js` share-processing logic. Instead of aggregating shares into round-state tables, the ingestion pipeline archives shares and maintains real-time operational state (hashrate, miner/worker activity, effort tracking).

```typescript
interface IngestionPipeline {
  processShares(shares: Share[], coinType: CoinType): Promise<void>;
}
```

**What it does:**

| Function | Description |
|---|---|
| Archive write | INSERT into `share_archive` (append-only, immutable) |
| Score bucket update | UPDATE `worker_score_buckets` (5-min aggregation for fast scoring) |
| Hashrate records | INSERT into `current_hashrate` |
| Miner/worker upsert | UPSERT `current_miners`, `current_workers` (activity tracking) |
| Metadata update | UPSERT `current_metadata` (effort, valid/invalid/stale counts) |
| User auto-creation | INSERT `current_users` ON CONFLICT DO NOTHING |

**What it does NOT do (vs v2 rounds.js):**
- ❌ No `current_rounds` table — eliminated entirely
- ❌ No round UUID assignment — there are no rounds
- ❌ No `round = 'current'` tracking — shares are never "in a round"
- ❌ No per-round work/times accumulation — scoring is computed on demand
- ❌ No `processSegments()` — share stream is continuous, not segmented by blocks
- ❌ No effort/work reset on block — effort is a rolling metric

**Improvements over v2:**
- async/await throughout (no callback nesting)
- Parameterized SQL ($1, $2, ...) everywhere
- Decimal.js for all math involving work/effort/difficulty
- Single code path for all coin types (parameterized by `coinType`)
- Structured error types with context
- Unit-testable with mock database

### 2b. Scoring Service (`src/services/scoring.ts`) — NEW

Implements the **true PPLNT** (Pay Per Last N Time) reward calculation using a continuous scoring window. See [06-pplnt-reward-design.md](06-pplnt-reward-design.md) for the full design rationale.

```typescript
interface ScoringService {
  // Compute reward distribution for a confirmed block
  computeScores(block: ConfirmedBlock): Promise<ScoringResult>;
  
  // Calculate payment amounts from scores
  calculatePayouts(block: ConfirmedBlock, scores: ScoringResult): Promise<PayoutPlan>;
}

interface ScoringResult {
  scores: Map<string, Decimal>;   // miner → time-weighted score
  totalScore: Decimal;
  windowStart: number;            // block.submitted - windowSize
  windowEnd: number;              // block.submitted
  sharesProcessed: number;
}
```

**How it works:**

When a block reaches the `generate` (confirmed) state, the ScoringService looks back over a configurable window (default: 3,600–7,200 seconds = 1–2 hours, exact value TBD per coin) from the block's discovery time. Every valid share in that window contributes to the score:

$$S_m = \sum_{i} d_i \cdot \min(\Delta t_i, 900)$$

Where $d_i$ is the share difficulty and $\Delta t_i$ is the time since the miner's previous share (capped at 900 seconds to prevent idle miners from accumulating credit).

**Key advantages over v2's round-based PPLNT:**
- No reward distortion when two blocks are found in quick succession
- No "empty round" problem — every block has a full scoring window
- Shares can contribute to multiple block rewards (overlapping windows)
- Burst miners don't get outsized rewards from short rounds
- Consistent, continuous hashrate is properly rewarded

### 3. Block Service (`src/services/blocks.ts`)

Replaces the current `checks.js`. Manages block lifecycle. With the true PPLNT design, the block service no longer manages round transitions — it simply tracks block state and triggers scoring when blocks confirm.

```typescript
interface BlockService {
  // Called by IngestionPipeline when a block-finding share arrives
  createPendingBlock(block: BlockFound, effort: Decimal): Promise<void>;
  
  // Called on timer — checks daemon for confirmations
  checkConfirmations(coinType: CoinType): Promise<void>;
  
  // State transitions
  handleImmature(block: Block, confirmations: number): Promise<void>;
  handleGenerate(block: Block): Promise<void>;   // triggers ScoringService
  handleOrphan(block: Block): Promise<void>;     // archive to historical_blocks
}
```

**Block state machine:**
```
pending ──(confirmations > 0)──> immature
immature ──(confirmations >= threshold)──> generate ──> triggers ScoringService
pending|immature ──(not in blockchain)──> orphan
```

**Orphan handling (simplified vs v2):**

With true PPLNT, orphans are dramatically simpler. In v2, orphaning a block required merging round work *back* into the current round — a complex, error-prone operation. In v3, there are no rounds to merge:

- On orphan: block record updated to `category = 'orphan'`
- Immature balance reversed for the affected miners
- Block archived to `historical_blocks`
- **No round merge needed** — shares in `share_archive` are untouched

**Balance updates:**
- `immature`: increment `current_balances.immature`
- `generate`: ScoringService computes payouts → update `current_balances.generate`
- `orphan`: reverse immature balance (generate balance never existed for orphans)

**Daemon interaction:**
- Query daemon via RPC: `getblock(hash)` for confirmations
- Uses the coin template's validation logic
- Configurable check interval (default: 53s, staggered)
- Block maturity threshold: per-coin configurable

#### Dual-Block Race Condition (Multi-Stratum)

**Problem:** When running multiple stratum servers, two servers can independently find blocks at the same height within seconds. Both submit to their local daemons, and both may be initially accepted before the network resolves the fork.

```
t=0s:   Stratum-EU finds block at height 1000
        → submits to daemon-EU → accepted → sends BlockFound to core
        
t=2s:   Stratum-US finds block at height 1000  
        → submits to daemon-US → accepted → sends BlockFound to core

t=5s:   Core has TWO pending blocks at height 1000
        Block A (hash=abc..., from EU)
        Block B (hash=def..., from US)

t=30s:  Network resolves fork — Block A wins, Block B orphaned
```

**Why this was dangerous in v2:** The v2 code performed round transitions on each block arrival, creating empty or corrupted rounds when two blocks competed.

**v3 Solution — No round transitions, so competing blocks are simple:**

With true PPLNT, there are **no rounds to transition**. When a block is found, the core simply creates a `pending` block record. Competing blocks at the same height both exist as `pending` — the confirmation checker resolves which one wins and which gets orphaned. The winning block's reward is scored using the sliding window at `generate` time.

```typescript
async handleBlockFound(block: BlockFound): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check for existing block at same height
    const existing = await client.query(
      `SELECT id, hash FROM current_blocks 
       WHERE height = $1 AND coin_type = $2 
       AND category IN ('pending', 'immature')`,
      [block.height, block.coinType]
    );
    
    // Create block record — 'competing' if another exists at this height
    const category = existing.rows.length > 0 ? 'competing' : 'pending';
    
    await this.insertBlock(client, {
      ...block,
      category,
      confirmations: -1,
      luck: await this.computeCurrentLuck(client, block.coinType),
    });
    
    if (category === 'competing') {
      logger.warn(`Competing block at height ${block.height}: ` +
        `existing=${existing.rows[0].hash.slice(0,12)}, ` +
        `new=${block.hash.slice(0,12)}`);
    }
    
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async resolveCompetingBlocks(blocks: Block[], coinType: CoinType): Promise<void> {
  for (const block of blocks) {
    const daemonBlock = await this.template.getBlock(block.hash);
    
    if (daemonBlock && daemonBlock.confirmations > 0) {
      // This block won — promote to immature
      await this.handleImmature(block, daemonBlock.confirmations);
    } else if (daemonBlock?.confirmations === -1 || !daemonBlock) {
      // This block lost or vanished — orphan it
      await this.handleOrphan(block);
    }
    // else: still unresolved (confirmations === 0), wait
  }
}
```

This is dramatically simpler than v2's approach because:
- No round transitions to coordinate or undo
- No "merge back" operations on orphan
- No "first-writer-wins" logic needed
- Competing blocks just coexist until the daemon resolves the fork
- The winning block gets scored independently when it reaches `generate`

### 4. Payment Service (`src/services/payments.ts`)

Replaces the current `payments.js`. Handles miner payouts. Now integrated with the ScoringService for true PPLNT reward distribution.

```typescript
interface PaymentService {
  // Called on timer
  processPayments(coinType: CoinType): Promise<void>;
  
  // Internal steps
  collectConfirmedBlocks(coinType: CoinType): Promise<Block[]>;
  scoreAndPlan(blocks: Block[]): Promise<PayoutPlan>;
  verifyWalletBalance(plan: PayoutPlan): Promise<boolean>;
  executePayment(plan: PayoutPlan): Promise<TransactionResult>;
  settleBalances(result: TransactionResult): Promise<void>;
}
```

**Payment flow:**

```
1. Query all blocks with category = 'generate' for coinType
2. Lock blocks via current_transactions (INSERT DO NOTHING RETURNING)
   → Only newly-inserted blocks proceed (prevents double-processing)
3. Lock blocks via current_payments (second lock — belt + suspenders)
4. For each locked block:
   a. Run ScoringService.computeScores() with the block's scoring window
   b. Compute per-miner payout amounts from scores
   c. Apply pool fee (per-coin + per-mode: solo vs shared; single recipient)
   d. Floor (truncate) fractional amounts — pool keeps the dust
   e. Store scoring snapshot in block_scores table
   f. Respect per-user custom payout limits (current_users.payout_limit)
5. Combine new payouts with existing miner balances
6. Filter miners above global minimum payout (+ miner's custom higher limit if set)
7. Verify daemon wallet has sufficient funds
8. Send batched payment via daemon RPC `sendmany` (single transaction, all recipients)
9. On success:
   a. Update current_balances (deduct balance, accumulate paid)
   b. Archive to historical_payments + historical_transactions
   c. Archive blocks to historical_blocks
   d. Delete paid blocks from current tables
   e. Clean up lock tables
   f. Send SSE event: `payment_sent`
   g. Send email notification to miners with payment_notifications enabled
10. On failure:
    a. Release all locks
    b. Log error with full context
    c. Alert via monitoring (Prometheus alert)
```

**Reward scheme** (true PPLNT):
- Uses `ScoringService.computeScores()` — a continuous time-weighted sliding window
- No per-round work tracking; scoring reads from `share_archive` + `worker_score_buckets`
- See [06-pplnt-reward-design.md](06-pplnt-reward-design.md) for full design

**Double-payment protection (preserved from v2):**
- Two-table locking: `current_transactions` AND `current_payments`
- Both use `INSERT ... ON CONFLICT DO NOTHING RETURNING id`
- Only blocks that succeed in BOTH inserts are processed
- Cleanup removes from both on failure or completion

**Financial precision:**
- All amounts in NUMERIC(20,8) in database
- All calculations in TypeScript use Decimal.js
- Never use JavaScript `number` for financial math

### 5. Statistics Service (`src/services/statistics.ts`)

Replaces the current `statistics.js`. Computes aggregate pool statistics.

```typescript
interface StatisticsService {
  // Called on timer
  computeStatistics(coinType: CoinType): Promise<void>;
}
```

**Computations:**
- Pool hashrate: `multiplier × totalWork × 1000 / windowMs`
- Per-miner hashrate: same formula per miner
- Per-worker hashrate: same formula per worker
- Active miner/worker counts (distinct in hashrate window)
- Share efficiency: `validShares / (validShares + invalidShares + staleShares) × 100`
- Multiple hashrate windows: 5m, 15m, 1h, 6h, 12h, 24h rolling averages
- Effort tracking: continuous (no reset on block); per-block luck computed at block-find time
  - Effort: revenue forecast for pool miners
  - Luck: displayed for solo miners
- Inactive miner/worker cleanup (reset to 0 hashrate)

**Writes to:**
- `current_metadata` (hashrate, efficiency, miners, workers counts)
- `current_miners` (hashrate, efficiency, share validity)
- `current_workers` (hashrate, efficiency, share validity)
- `historical_metadata` (time-bucketed pool stats)
- `historical_miners` (time-bucketed miner stats)
- `historical_workers` (time-bucketed worker stats)

### 6. Network Service (`src/services/network.ts`)

Replaces the current `network.js`. Simple passthrough.

```typescript
interface NetworkService {
  updateNetworkState(state: NetworkState): Promise<void>;
}
```

Writes difficulty, hashrate, and height to `current_network` (upsert, one row per coin type).

### 7. Miner Service (`src/services/miners.ts`)

**New service** (logic currently scattered across rounds/statistics/checks):

```typescript
interface MinerService {
  // Auto-create miner on first share
  ensureMinerExists(address: string, coinType: CoinType): Promise<void>;
  
  // Query miner state
  getMinerBalance(address: string, coinType: CoinType): Promise<Balance>;
  getMinerWorkers(address: string, coinType: CoinType): Promise<Worker[]>;
  
  // User settings
  updatePayoutLimit(address: string, limit: number, token: string): Promise<void>;
}
```

Centralizes miner-related logic that's currently duplicated across modules.

---

## REST API (`src/api/`)

### Framework: Fastify

Why Fastify over Express:
- 3-5x faster request handling
- Built-in JSON Schema validation (replaces 988 lines of manual validation in v2 `endpoints.js`)
- Automatic OpenAPI/Swagger generation from schemas
- Built-in serialization (faster JSON.stringify via fast-json-stringify)
- Request/reply hooks instead of Express middleware chain

### Route Structure

```
GET /health                              → Health check (per-coin daemon status)
GET /api/v3/pools                        → List pools
GET /api/v3/:pool                        → Pool metadata
GET /api/v3/:pool/current/:endpoint      → Current state queries
GET /api/v3/:pool/historical/:endpoint   → Historical data queries
GET /api/v3/:pool/combined/:endpoint     → Merged current+historical
GET /api/v3/:pool/events                 → SSE push event stream
```

> **Note:** The API is versioned as v3. A new frontend is planned, so the API does not need backwards compatibility with the existing v2 API format. The API is fully public — no authentication required for any endpoint.

### Schema-Driven Validation

Instead of 50 lines of manual validation per endpoint:

```typescript
// v2: 50 lines of manual validation per endpoint in endpoints.js
// v3: JSON Schema declaration
const currentBlocksSchema = {
  querystring: {
    type: 'object',
    properties: {
      limit:     { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
      offset:    { type: 'integer', minimum: 0, default: 0 },
      order:     { type: 'string', enum: ['timestamp', 'height', 'difficulty', 'reward', 'luck'] },
      direction: { type: 'string', enum: ['ascending', 'descending'], default: 'descending' },
      miner:     { type: 'string', pattern: '^[a-zA-Z0-9]+$' },
      worker:    { type: 'string', pattern: '^[a-zA-Z0-9._-]+$' },
      category:  { type: 'string', enum: ['pending', 'immature', 'generate', 'orphan'] },
      type:      { type: 'string', enum: ['primary', 'auxiliary'] },
      solo:      { type: 'boolean' },
    }
  }
};

fastify.get('/api/v3/:pool/current/blocks', { schema: currentBlocksSchema }, handler);
```

Fastify auto-validates, coerces types, and returns 400 with structured errors on invalid input.

### Response Format

```json
{
  "version": "v3",
  "statusCode": 200,
  "headers": {},
  "body": [ ... ]
}
```

The response format is designed for the new frontend. No v2 backwards compatibility required.

### Endpoints

**Current (11):**
| Endpoint | Key query params |
|---|---|
| `/current/blocks` | miner, worker, category, solo, coin_type, height, luck |
| `/current/hashrate` | miner, worker, solo, coin_type |
| `/current/metadata` | identifier, solo, coin_type |
| `/current/miners` | miner, solo, coin_type |
| `/current/network` | coin_type |
| `/current/payments` | coin_type |
| `/current/scores` | miner, worker, solo, block_id, coin_type |
| `/current/transactions` | coin_type |
| `/current/users` | miner, coin_type |
| `/current/workers` | miner, worker, solo, coin_type |
| `/current/configuration` | — (returns pool config metadata) |

**Historical (8):**
blocks, metadata, miners, network, payments, scores, transactions, workers

**Combined (2):**
blocks, scores (merges current + historical with `partition` label)

**All endpoints support:** `limit`, `offset`, `order`, `direction` (pagination/sorting)  
**Numeric fields support:** comparison prefixes `lt`, `le`, `gt`, `ge`, `ne` (preserved from v2)

### SSE Event Stream

The `/events` endpoint provides real-time push notifications via Server-Sent Events:

```
GET /api/v3/:pool/events
Accept: text/event-stream

event: block_found
data: {"coin":"raptoreum","height":1234567,"miner":"RGY1...","hash":"abc..."}

event: payment_sent
data: {"coin":"raptoreum","tx":"def...","miners":42,"total":"1250.00000000"}

event: worker_offline
data: {"miner":"RGY1...","worker":"rig01","last_share":1708200000}
```

**Event types:**
| Event | Trigger |
|---|---|
| `block_found` | New block detected by any miner |
| `payment_sent` | Payment cycle completed |
| `worker_offline` | Worker idle > inactivity threshold |

Clients reconnect automatically via `Last-Event-Id` header. SSE was chosen over WebSocket for simplicity, HTTP caching compatibility, and automatic reconnection.

### Per-Endpoint Caching

Each endpoint has a configurable TTL cache. Cache keys include query parameters (miner, coin_type, etc.):

| Endpoint Group | Default TTL |
|---|---|
| `/current/hashrate` | 5s |
| `/current/blocks` | 10s |
| `/current/miners`, `/current/workers` | 10s |
| `/current/metadata` | 5s |
| `/current/network` | 30s |
| `/current/payments`, `/current/transactions` | 60s |
| `/historical/*` | 5min |
| `/current/configuration` | 1h |

### Per-Endpoint Rate Limiting

Each endpoint group has configurable rate limits (requests per window per IP):

| Endpoint Group | Default Limit | Window |
|---|---|---|
| `/current/*` | 60 req | 1 min |
| `/historical/*` | 30 req | 1 min |
| `/events` (SSE) | 5 connections | — |
| `/health` | 120 req | 1 min |

---

## Coin Templates (`src/templates/`)

Abstraction layer for coin-specific daemon interactions.

```typescript
interface CoinTemplate {
  name: string;
  symbol: string;
  algorithm: string;
  
  // Daemon RPC wrappers
  getBlockTemplate(): Promise<BlockTemplate>;
  submitBlock(hex: string): Promise<SubmitResult>;
  getBlock(hash: string): Promise<BlockInfo>;
  getBalance(): Promise<Decimal>;
  
  // Block confirmation & scoring
  validateBlocks(blocks: Block[]): Promise<BlockValidation[]>;
  calculateBlockRewards(
    block: BlockData,
    recipients: Recipient[],
    sending: boolean
  ): Promise<WorkerRewards>;
  
  // Payment
  validateBalance(amount: Decimal): Promise<boolean>;
  sendPayment(outputs: PaymentOutput[]): Promise<TransactionResult>;  // uses daemon sendmany RPC
}
```

**Implementations:**
- `RaptoreumTemplate` (primary target)
- `BlocxTemplate`
- `DiabaseTemplate`
- `NetsisTemplate`

Each wraps the coin's specific RPC calls and handles any quirks.

---

## Replay System (`src/replay/`)

### CLI Interface

```bash
# Replay a time range (recompute all derived state)
foundation-core replay --from "2026-02-01T00:00:00Z" --to "2026-02-15T23:59:59Z"

# Dry run — compute but don't write, report differences
foundation-core replay --from "2026-02-01" --to "2026-02-15" --dry-run

# Replay for a specific miner
foundation-core replay --miner "RGY1sRzh..." --from "2026-02-10"

# Re-score a specific block
foundation-core rescore --block-id 12345

# Full rebuild from archive
foundation-core replay --full --confirm

# Export share data for external analysis
foundation-core replay --from "2026-02-01" --to "2026-02-15" --export shares.csv
```

### Replay Engine

```typescript
interface ReplayEngine {
  replay(options: ReplayOptions): Promise<ReplayResult>;
}

interface ReplayOptions {
  from?: Date;
  to?: Date;
  miner?: string;
  blockId?: number;
  full?: boolean;
  dryRun?: boolean;
  export?: string;
}

interface ReplayResult {
  sharesProcessed: number;
  blocksFound: number;
  blocksRescored: number;
  balancesDiff: Map<string, { before: Decimal, after: Decimal }>;
  duration: number;
  errors: ReplayError[];
}
```

### How Replay Works

```
1. Read raw shares from share_archive for the given range
   (SELECT * FROM share_archive WHERE timestamp BETWEEN $1 AND $2 ORDER BY timestamp)

2. If not --dry-run:
   a. Delete all derived data for that range:
      - worker_score_buckets where bucket_time BETWEEN range
      - current_hashrate where timestamp BETWEEN range
      - current_metadata → recalculated
      - current_miners → recalculated
      - current_workers → recalculated
   b. Note: current_blocks are NOT deleted (they're verified against daemon)
   c. Note: current_balances are recalculated from surviving data

3. Feed shares through the same IngestionPipeline.processShares() pipeline
   (identical code path as live processing)

4. Recompute statistics via StatisticsService

5. If --dry-run:
   - Compare derived state against current state
   - Report discrepancies (miner X: balance was 5.2, replay says 5.18)
   
6. Report results
```

**Key constraint:** The processing pipeline MUST be deterministic — given the same shares in the same order, it produces identical output. This is ensured by:
- Ordering archive reads by timestamp + UUID
- Using NUMERIC types (no floating-point non-determinism)
- No randomness in processing logic

---

## Process Model

### Single-Process Default

Unlike v2's cluster forks, the core server runs as a **single process** by default:
- Node.js handles I/O concurrency via the event loop
- Database operations are async (pg-pool handles connection multiplexing)
- CPU-bound work is minimal (no hash validation)
- Simpler debugging, no inter-process coordination

### Optional Clustering

If needed for API throughput, use a reverse proxy (nginx/caddy) in front of multiple core instances:
- Each instance has its own pg-pool
- Processing services run on only ONE instance (configurable `primary` flag)
- API instances are stateless and horizontally scalable

```
         ┌─── core (primary: API + processing)
nginx ───┤
         ├─── core (API only)
         └─── core (API only)
```

This is simpler than v2's cluster model and avoids the staggered-interval coordination, transaction-based locking across forks, and process.env config serialization.

### Scheduled Tasks

| Service | Default Interval | Description |
|---|---|---|
| BlockService.checkConfirmations | 53s | Poll daemon for block confirmations |
| PaymentService.processPayments | 6h | Process payout queue |
| StatisticsService.computeStatistics | 5s | Update hashrate/efficiency |
| Archive partition management | 24h | Create new partitions, compress old |
| Inactive cleanup | 10min | Remove stale miners/workers/hashrate |

All intervals configurable. No staggering needed (single process).

---

## Configuration

```typescript
// src/config/schema.ts
interface CoreConfig {
  general: {
    identifier: string;        // "europe"
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logFormat: 'json' | 'pretty';  // json for production, pretty for development
    primary: boolean;          // Run processing services (true for main instance)
  };

  database: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: boolean;
    poolMin: number;           // Default: 2
    poolMax: number;           // Default: 20
    statementTimeout: number;  // Default: 30000ms
  };

  grpc: {
    host: string;              // "0.0.0.0"
    port: number;              // 50051
    tls: boolean;
    certPath?: string;
    keyPath?: string;
    caPath?: string;
    maxReceiveSize: number;    // Default: 4MB
  };

  api: {
    enabled: boolean;
    host: string;              // "0.0.0.0"
    port: number;              // 3001
    tls: boolean;
    cors: boolean;
    rateLimit: {
      enabled: boolean;
      // Per-endpoint rate limits (see REST API section)
    };
    cache: {
      enabled: boolean;
      // Per-endpoint TTLs (see REST API section)
    };
    sse: {
      enabled: boolean;
      maxConnections: number;  // Default: 100
      heartbeatMs: number;     // Default: 30000
    };
  };

  processing: {
    batchSize: number;         // Default: 15000
    intervals: {
      checks: number;          // Default: 53000ms
      payments: number;        // Default: 21600000ms (6h)
      statistics: number;      // Default: 5000ms
      cleanup: number;         // Default: 600000ms (10min)
    };
    windows: {
      hashrate: number[];       // Default: [300000, 900000, 3600000, 21600000, 43200000, 86400000] (5m, 15m, 1h, 6h, 12h, 24h)
      inactive: number;         // Default: 600000ms (10min)
    };
    pplnt: {
      windowSeconds: number;    // Default: 3600-7200 (1-2h, per coin)
      timeCapSeconds: number;   // Default: 900
    };
  };

  archive: {
    retentionMonths: number;   // Default: 3 (hot in PostgreSQL, then dropped)
    backup: {
      enabled: boolean;
      schedule: string;        // Default: daily pg_dump
      retentionDays: number;   // Default: 30 (rotate old dumps)
    };
  };

  email: {
    enabled: boolean;
    smtp: {
      host: string;
      port: number;            // Default: 587
      secure: boolean;
      user?: string;
      password?: string;
    };
    from: string;              // "pool@example.com"
    templates: {
      paymentSent: string;     // Path to email template
      workerOffline: string;
    };
  };

  pools: PoolConfig[];         // Array of pool configs (coin-specific)
}
```

---

## Error Handling Strategy

### Structured Errors

```typescript
class PoolError extends Error {
  constructor(
    public code: string,           // "PAYMENT_INSUFFICIENT_FUNDS"
    public message: string,
    public context: Record<string, unknown>,
    public retryable: boolean,
  ) {
    super(message);
  }
}

// Usage
throw new PoolError(
  'PAYMENT_INSUFFICIENT_FUNDS',
  `Wallet balance ${balance} < required ${required}`,
  { balance: balance.toString(), required: required.toString(), coinType },
  true  // retry later — wallet may receive funds
);
```

### Error Categories

| Code Prefix | Meaning | Action |
|---|---|---|
| `INGEST_*` | Share ingestion errors | Log, NAK the share batch |
| `SCORING_*` | Scoring / reward calc errors | Log, retry on next interval |
| `BLOCK_*` | Block check errors | Log, retry on next interval |
| `PAYMENT_*` | Payment errors | Log, alert, retry on next interval |
| `STATS_*` | Statistics errors | Log, retry on next interval |
| `DB_*` | Database errors | Log, circuit breaker, retry with backoff |
| `API_*` | API errors | Return appropriate HTTP status |

### No Silent Failures

Every error is logged with full context (unlike v2 which swallows errors with `() => {}`). Critical errors (payment failures, DB connection loss) trigger alerts.

---

## Dependencies

```json
{
  "dependencies": {
    "@grpc/grpc-js": "^1.10",
    "fastify": "^4.26",
    "@fastify/cors": "^9",
    "@fastify/rate-limit": "^9",
    "@fastify/compress": "^7",
    "@fastify/swagger": "^8",
    "@fastify/swagger-ui": "^3",
    "pg": "^8.13",
    "pg-pool": "^3.7",
    "node-pg-migrate": "^7",
    "decimal.js": "^10.4",
    "ts-proto": "^1.176",
    "pino": "^8",
    "uuid": "^9",
    "dotenv": "^16",
    "commander": "^12",
    "nodemailer": "^6"
  },
  "devDependencies": {
    "typescript": "^5.4",
    "@types/node": "^22",
    "@types/pg": "^8",
    "@types/nodemailer": "^6",
    "jest": "^29",
    "ts-jest": "^29",
    "@testcontainers/postgresql": "^10",
    "eslint": "^8",
    "@typescript-eslint/eslint-plugin": "^7",
    "prettier": "^3"
  }
}
```
