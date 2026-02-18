# Foundation v3 — Implementation Phases

## Overview

The project is split into 6 phases, designed to minimize risk by keeping production running at every step. The key strategy: **build the Rust stratum server first with a v2-compatibility layer**, so it can replace the existing stratum servers immediately while the v2 core continues running. Then build the new core and cut over.

**Key capabilities delivered:**
- **Stratum V1** high-performance mining protocol (V2 deferred to future release)
- **Multi-coin, multi-algorithm** — single binary serves multiple coins via port routing
- **True PPLNT** — continuous sliding-window scoring with no round boundaries
- **Modern Rust + TypeScript** stack with SQLite WAL, gRPC, Fastify, SSE push events
- **Docker Compose** deployment with Prometheus + Grafana monitoring

**Estimated timeline:** 5–7 months for a single developer, 3–4 months with two.

### Phasing Strategy

```
Phase 1: Scaffolding + Proto + FFI spike
    │
Phase 2: Rust Stratum (V1, multi-coin)    ◄── replaces current stratum in production
    │         + v2-compat output                v2 core continues as-is
    │
Phase 3: Foundation Core (TypeScript)      ◄── true PPLNT, tested against mock data
    │         IngestionPipeline + ScoringService
    │
Phase 4: Stratum gRPC forwarder           ◄── adds gRPC output alongside v2-compat
    │
Phase 5: Integration & Testing            ◄── both paths running, compared
    │
Phase 6: Migration & Cutover              ◄── switch stratum output from v2-compat to gRPC
                                                disable v2 core, v3 core takes over
```

This approach gives you:
- **Immediate value:** Rust stratum replaces Node.js stratum (performance + multi-coin) while nothing else changes
- **Zero risk to payments:** v2 core handles payments throughout until v3 core is proven
- **Gradual migration:** Each phase is independently deployable and rollback-safe
- **Production validation:** The Rust stratum is battle-tested with real miners before v3 core even exists

---

## Phase 1: Project Scaffolding & Shared Contracts

**Duration:** 1–2 weeks  
**Goal:** Set up the monorepo, tooling, CI, the shared Protobuf/gRPC contract (with multi-coin fields), and validate GhostRider FFI feasibility.

### Tasks

- [ ] Create monorepo structure (`foundation/` root with `foundation-stratum/` and `foundation-core/` sub-projects)
- [ ] Initialize Rust workspace (`Cargo.toml`, clippy, rustfmt)
- [ ] Initialize TypeScript project (`package.json`, `tsconfig.json`, ESLint, Prettier)
- [ ] Define Protobuf service contract (`proto/stratum_ingest.proto`) — include `coin` field in all share/block messages
- [ ] Set up Docker Compose for local development and deployment (PostgreSQL 16, Prometheus, Grafana)
- [ ] Set up CI pipeline (lint, test, build for both Rust and TS)
- [ ] Create Makefile with top-level commands (`make build`, `make test`, `make dev`, `make proto`)
- [ ] Generate gRPC stubs for both Rust (tonic-build) and TypeScript (@grpc/proto-loader or ts-proto)
- [ ] GhostRider FFI spike — verify we can call the existing `gr.so` from Rust and get correct hashes
- [ ] Algorithm plugin loader spike — verify `libloading::Library` can hot-load a `.so` and call its hash function
- [ ] Write initial README with setup instructions

### Deliverable

A clean monorepo where `make build` compiles both projects. The Protobuf contract compiles and generates types for both languages (with `coin` discriminator). GhostRider FFI proof-of-concept produces correct hashes.

### Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Monorepo vs multi-repo | Monorepo | Shared proto definitions, atomic cross-project changes, simpler CI |
| Protobuf codegen (Rust) | tonic + prost | De facto standard for gRPC in Rust |
| Protobuf codegen (TS) | ts-proto | Generates idiomatic TypeScript types (not the verbose google-protobuf style) |
| Package manager (TS) | pnpm | Faster, stricter, disk-efficient |

---

## Phase 2: Foundation Stratum Server (Rust) — with v2-Compatible Output

**Duration:** 5–7 weeks  
**Goal:** Build a production-grade stratum server in Rust with **Stratum V1 protocol** and **multi-coin, multi-algorithm routing**. It writes shares to the v2 worker-local PostgreSQL database in the exact same format via a v2-compat output backend, so the existing v2 core processes them without any changes.

### Why Stratum First

1. The current stratum is the performance bottleneck (Node.js handling TCP + hash validation)
2. Building it first lets you validate the Rust implementation with real miners immediately
3. The v2 core is stable and handles payments correctly — no reason to touch it yet
4. The stratum server is a self-contained component with a clear interface boundary

### Architecture During Phase 2

```
 Miners (Stratum V1)
     │
     ▼
┌───────────────────────────────────────────────────┐
│      foundation-stratum (Rust) — NEW              │
│                                                   │
│  ┌──────────────┐                                 │
│  │ V1 Listener  │                                 │
│  │ (JSON-RPC)   │                                 │
│  └──────┬───────┘                                 │
│         │                                         │
│         ▼                                         │
│  Port → CoinProfile routing                      │
│  Algorithm Plugin (GhostRider etc.)               │
│  Share Validation → Mining Engine                 │
│         │                                         │
│         ▼                                         │
│  ┌─────────────────────────────────────────┐      │
│  │  Output Backend (pluggable)             │      │
│  │  [v2-compat] PostgreSQL writer ◄── Active      │
│  │  [v3-native] gRPC forwarder   ◄── Phase 4     │
│  └─────────────────────────────────────────┘      │
└───────────────────────────────────────────────────┘
        │
        ▼ (v2-compat mode: same as current)
┌───────────────────────────────────────────────────┐
│      v2 Core (existing Node.js) — UNCHANGED       │
└───────────────────────────────────────────────────┘
```

### v2-Compatible Output Backend

The Rust stratum writes shares to the **existing v2 worker-local PostgreSQL** using the exact same schema:

```rust
// src/output/v2_compat.rs
pub struct V2CompatWriter {
    pool: PgPool,  // connects to v2 worker-local DB
}

impl ShareOutput for V2CompatWriter {
    async fn write_share(&self, share: &ValidatedShare) -> Result<()> {
        // INSERT INTO local_shares (uuid, timestamp, submitted, ip, port,
        //   addrprimary, addrauxiliary, blockdiffprimary, blockdiffauxiliary,
        //   blockvalid, blocktype, clientdiff, hash, height, identifier,
        //   reward, sharediff, sharevalid, transaction)
        // VALUES ($1, $2, ..., $19)
        // ON CONFLICT (uuid) DO NOTHING
        
        // Uses EXACT same column names and types as v2 worker/local/shares.js
        sqlx::query(INSERT_SHARE_V2)
            .bind(&share.uuid)
            .bind(share.timestamp)
            // ... all v2 columns mapped
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
```

The v2 core's `rounds.js` picks up these shares on its normal polling interval — it doesn't know or care that they came from Rust instead of Node.js.

### Phase 2a: V1 TCP Server & Multi-Coin Engine (Week 1–3)

- [ ] Tokio-based async TCP listener with configurable bind addresses
- [ ] TLS support via tokio-rustls (certificate loading from config)
- [ ] Per-connection handler with read/write split

**Stratum V1 (JSON-RPC):**
- [ ] V1 protocol parser:
  - `mining.subscribe`
  - `mining.authorize`
  - `mining.submit`
  - `mining.set_difficulty` (server → client)
  - `mining.notify` (server → client)
- [ ] Connection state machine (subscribing → authorized → mining)
- [ ] Wallet address format validation on `mining.authorize` (reject invalid addresses)

**Common:**
- [ ] Connection timeout handling (configurable idle timeout)
- [ ] Graceful shutdown (drain active connections)
- [ ] Connection metrics (count, duration, shares/sec)
- [ ] Unit tests for V1 protocol parsing
- [ ] Integration tests with mock V1 miner client

**Deliverable:** V1 TCP server accepts connections. Multi-coin mining engine validates shares per algorithm per port.

### Phase 2b: Multi-Coin Mining Engine (Week 3–5)

**Coin Profile System:**
- [ ] `CoinProfile` struct: daemon RPC config, algorithm, pool address, fee recipients, block maturity
- [ ] Port → coin routing: each listen port maps to a specific `CoinProfile`
- [ ] Per-coin daemon RPC client (block template polling, block submission)
- [ ] Per-coin block template manager with independent job sequences

**Algorithm Plugin System:**
- [ ] `HashAlgorithm` trait: `fn hash(header: &[u8], params: &AlgorithmParams) -> [u8; 32]`
- [ ] Built-in algorithms: Sha256d, Scrypt, GhostRider
- [ ] FFI algorithm loader via `libloading`: load any `.so` implementing the C ABI hash function
- [ ] GhostRider algorithm integration (FFI to existing gr.so, 20 CryptoNight rotation multipliers)

**Core Mining Engine:**
- [ ] Job manager (create jobs from templates, track active jobs per coin, expire old jobs)
- [ ] Share validation framework:
  - Verify share meets client difficulty target
  - Verify share meets block difficulty target (block solution)
  - Algorithm-specific hash computation via `HashAlgorithm` trait
- [ ] VarDiff engine:
  - Track share submission rate per connection
  - Retarget difficulty to maintain target submission interval
  - Configurable per port: initial, minimum, maximum, targetTime, retargetTime, variance
- [ ] Miner banning:
  - Track invalid share percentage per IP (global across all coins)
  - Temporary ban when threshold exceeded
  - Configurable: banLength, checkThreshold, invalidPercent, purgeInterval
- [ ] Block submission to correct coin daemon when valid block found
- [ ] ZMQ block notification support (alternative to polling)

**Deliverable:** Multi-coin stratum server validates shares against correct algorithm per port. GhostRider shares validated correctly. New coins added via config + optional `.so` plugin.

### Phase 2c: v2-Compatible Output & Local WAL (Week 5–7)

- [ ] Pluggable output backend trait:
  ```rust
  #[async_trait]
  pub trait ShareOutput: Send + Sync {
      async fn write_share(&self, share: &ValidatedShare) -> Result<()>;
      async fn write_block(&self, block: &BlockFound) -> Result<()>;
      async fn flush(&self) -> Result<()>;
  }
  ```
- [ ] v2-compat PostgreSQL writer (connects to existing worker-local DB)
- [ ] Map Rust share data to exact v2 column schema
- [ ] Verify v2 core correctly picks up and processes Rust-produced shares
- [ ] SQLite WAL for local durability (same design as in spec):
  - Share written to WAL first, then to PostgreSQL
  - If PostgreSQL write fails, share survives in WAL
  - Background retry drains WAL on reconnection
- [ ] Integration test: Rust stratum → v2 worker DB → v2 core processes share correctly

**Deliverable:** Shares written by Rust stratum are indistinguishable from those written by Node.js stratum. v2 core processes them correctly.

### Phase 2d: Configuration & Operations (Week 6–7)

- [ ] TOML configuration file (see [02-stratum-server-spec.md](02-stratum-server-spec.md))
- [ ] Multi-coin config: `[[coins]]` sections with per-coin daemon/algorithm/recipients
- [ ] Multi-port config: `[[ports]]` sections with port → coin routing
- [ ] GR hashrate multipliers in TOML per-coin config
- [ ] Manual `stratum_id` configuration setting
- [ ] Backwards-compatible config mapping from v2 pool config format (single-coin mode)
- [ ] Structured logging (tracing crate, configurable: JSON for prod, text for dev)
- [ ] Prometheus metrics endpoint (`/metrics`) — per-coin breakdowns
- [ ] Signal handling:
  - SIGTERM/SIGINT → graceful shutdown
  - SIGHUP → hot config reload (pools, fees, VarDiff) without dropping connections
- [ ] Docker Compose service definition
- [ ] Health check endpoint (HTTP `/health`) — per-coin daemon connectivity

**Deliverable:** Fully configurable. Drop-in replacement for current stratum with V1 and multi-coin support.

### Phase 2e: Production Validation (Week 7)

- [ ] Deploy Rust stratum on one V1 port alongside existing Node.js stratum
- [ ] Direct a subset of miners to Rust stratum port
- [ ] Compare: share acceptance rates, block finds, VarDiff behavior
- [ ] Monitor: memory usage, CPU usage, connection stability
- [ ] Run for 1 week minimum with real miners
- [ ] Fix any edge cases discovered with real miner software (XMRig, SRBMiner, cpuminer-gr, etc.)
- [ ] Full cutover: all miners on Rust stratum, Node.js stratum disabled
- [ ] Run for 1 week with full load, confirm v2 core is processing correctly

**Deliverable:** Rust stratum running in production, serving all miners, v2 core processing shares normally. Node.js stratum retired.

---

## Phase 3: Foundation Core Server (TypeScript)

**Duration:** 6–8 weeks  
**Goal:** Build the complete core server with gRPC ingestion, **true continuous PPLNT scoring** (no round boundaries), REST API, and replay tooling. Testable independently with mock share data. Does NOT need to be connected to production stratum yet.

### Phase 3a: Database Layer (Week 1–2)

- [ ] Design and document the full database schema (see [04-database-design.md](04-database-design.md))
- [ ] Set up node-pg-migrate for version-controlled TypeScript migrations
- [ ] Create initial migration: all current_* tables with NUMERIC types, proper indexes
- [ ] Create `worker_score_buckets` table (5-min pre-aggregated PPLNT scoring buckets)
- [ ] Create `block_scores` table (immutable per-miner payout distributions per confirmed block)
- [ ] Create share_archive partitioned table with pg_partman auto-partitioning
- [ ] Create historical_* tables
- [ ] Implement connection pool manager (pg-pool) with health checks
- [ ] Build parameterized query layer (prepared statements, typed results)
- [ ] Write database integration tests against Docker PostgreSQL
- [ ] Implement archive partition management (create/detach/compress old partitions)

**Deliverable:** `make db:migrate` creates all tables. Query layer passes integration tests. Share archive auto-partitions monthly.

### Phase 3b: gRPC Ingestion Service (Week 2–3)

- [ ] Implement gRPC server using @grpc/grpc-js with TLS support
- [ ] Implement `SubmitShares` RPC handler:
  - Validate incoming share batch (includes `coin` field for multi-coin routing)
  - Write raw shares to share_archive (append-only)
  - Dispatch shares to IngestionPipeline
  - Return ShareAck with accepted UUIDs
- [ ] Implement `SubmitBlock` RPC handler:
  - Write block to current_blocks as `pending` (with `coin` field)
  - Create competing block detection (same height + coin + solo)
  - No round UUID assignment — blocks scored independently at confirmation time
- [ ] Implement `ReportNetwork` RPC handler
- [ ] Add connection authentication (server TLS + bearer token)
- [ ] Write integration tests with mock stratum client
- [ ] Load testing: measure throughput (target: 10,000+ shares/sec ingestion)

**Deliverable:** gRPC server accepts share batches, archives them, returns ACKs. Passes load tests.

### Phase 3c: Processing Pipeline — True PPLNT (Week 3–5)

Build the core processing logic using **continuous sliding-window PPLNT** (see [06-pplnt-reward-design.md](06-pplnt-reward-design.md)).

#### IngestionPipeline (replaces rounds.js — no more round boundaries)
- [ ] Append shares to `share_archive` (immutable raw data)
- [ ] UPSERT into `worker_score_buckets` (5-min pre-aggregated time_score buckets)
- [ ] Accumulate `current_hashrate` records
- [ ] Upsert `current_miners` / `current_workers` state
- [ ] Auto-create `current_users` on first seen miner
- [ ] Process `coin` field to route shares to correct per-coin pipeline state
- [ ] **No round transitions, no round UUIDs, no segment processing**

#### ScoringService (NEW — continuous PPLNT scoring at block confirmation time)
- [ ] `computeScores(blockTimestamp, coin, solo)`: query `worker_score_buckets` for the sliding window
  - Window: `[blockTimestamp - windowSeconds, blockTimestamp]`
  - Score formula: `S_m = Σ(bucket.time_score)` for each miner in window
  - Percentage: `pct_m = S_m / Σ(S_all)`
- [ ] `calculatePayouts(blockId)`: apply pool fee, compute per-miner reward amounts
- [ ] Store results in `block_scores` table (immutable per-miner payout distribution)
- [ ] Implement streaming cursor for large scoring windows (memory-efficient)
- [ ] Cache recent bucket aggregates for performance
- [ ] Solo block handling: solo miner gets 100% of reward (no window scoring needed)

#### BlockService (simplified — replaces checks.js)
- [ ] Poll daemon for block confirmations (per coin)
- [ ] State machine: `pending → competing → immature → generate / orphan`
- [ ] Competing block resolution: same height + coin + solo — daemon confirms which wins
  - Winner: promoted to `immature`, loser: set to `orphan`
  - **No round transition needed** — just update block category
- [ ] On `immature → generate`: trigger ScoringService to compute payouts, update balances
- [ ] On orphan: reverse immature balance credits (if any)
- [ ] Historical archival of confirmed/orphaned blocks

#### PaymentService (replaces payments.js)
- [ ] Double-lock payment protection (transactions + payments tables, keyed by `block_id`)
- [ ] Per-user custom payout limits
- [ ] Wallet balance verification before sending (per coin daemon)
- [ ] Blockchain transaction submission via daemon RPC
- [ ] Balance settlement (deduct paid, accumulate paid total)
- [ ] Payment and transaction archival
- [ ] Failure cleanup (release locks on error)
- [ ] Multi-coin: separate payment cycles per coin

#### StatisticsService (replaces statistics.js)
- [ ] Hashrate computation (multiplier × work × 1000 / window)
- [ ] Active miner/worker counting (per coin)
- [ ] Share efficiency calculation
- [ ] 12h/24h rolling average hashrate
- [ ] Inactive miner/worker cleanup
- [ ] Current + historical metadata updates

#### NetworkService (replaces network.js)
- [ ] Network state persistence per coin (difficulty, hashrate, height)
- [ ] Triggered by gRPC ReportNetwork

**Key improvements over v2:**
- [ ] **True PPLNT** — continuous sliding window, no round boundaries, no unfairness on successive blocks
- [ ] **No RoundService** — eliminated entirely; shares flow through IngestionPipeline, scoring happens at block confirmation
- [ ] Per-coin processing via `coin` field throughout the pipeline
- [ ] Eliminate primary/auxiliary code duplication — single parameterized code path with `coinType` parameter
- [ ] async/await throughout (no callback nesting)
- [ ] Structured error handling with error codes and context
- [ ] All financial math uses NUMERIC/Decimal.js (no floating point)
- [ ] Parameterized SQL everywhere
- [ ] Unit tests for each service, integration tests for the pipeline

**Deliverable:** Full processing pipeline handles mock share streams end-to-end. True PPLNT scoring produces correct payouts. Blocks, payments, and statistics all verified by tests. Multi-coin routing works.

### Phase 3d: REST API (Week 6–7)

- [ ] Set up Fastify with JSON Schema validation
- [ ] Implement all current API endpoints (current, historical, combined)
- [ ] Add per-coin filtering to all endpoints (`?coin=raptoreum`)
- [ ] Schema-driven validation (replaces 988 lines of manual boilerplate in endpoints.js)
- [ ] Rate limiting (fastify-rate-limit)
- [ ] Response caching (fastify-caching or custom)
- [ ] CORS, compression, TLS
- [ ] OpenAPI spec auto-generation from route schemas
- [ ] Health/readiness endpoints (per-coin daemon status)
- [ ] Backwards-compatible response format (same JSON envelope)
- [ ] API integration tests

**Deliverable:** REST API serves all endpoints with schema validation and multi-coin support. OpenAPI spec generated. Response format matches v2 for frontend compatibility.

### Phase 3e: Replay CLI (Week 7–8)

- [ ] `replay` command: read from share_archive, re-run through IngestionPipeline
- [ ] Time range filtering (`--from`, `--to`)
- [ ] Coin filtering (`--coin`)
- [ ] Miner filtering (`--miner`)
- [ ] `rescore` command: recompute `block_scores` for specific blocks from `worker_score_buckets`
- [ ] Dry-run mode (compute but don't write)
- [ ] Diff reporting (compare recomputed vs current state)
- [ ] Full rebuild mode (`--full`) — rebuild all derived state from share_archive
- [ ] Progress reporting for long replays

**Deliverable:** `foundation-core replay --from 2026-02-01 --to 2026-02-15 --coin raptoreum --dry-run` completes successfully against test data.

---

## Phase 4: Stratum gRPC Forwarder & Dual Output

**Duration:** 1–2 weeks  
**Goal:** Add the gRPC forwarder to the Rust stratum as a second output backend, running alongside the v2-compat PostgreSQL writer. This enables the shadow-comparison phase.

### Tasks

- [ ] Implement gRPC output backend (`V3GrpcForwarder`):
  ```rust
  impl ShareOutput for V3GrpcForwarder {
      // SQLite WAL → batch gRPC → core server → ACK → delete from WAL
  }
  ```
- [ ] SQLite WAL manager (as specified in stratum server spec)
- [ ] Batch forwarder with retry/backoff (as specified)
- [ ] Dual-output mode: write to BOTH v2-compat PostgreSQL AND gRPC simultaneously
  ```toml
  [output]
  mode = "dual"  # "v2-compat" | "grpc" | "dual"
  
  [output.v2_compat]
  host = "127.0.0.1"
  port = 5432
  database = "foundation_local"
  
  [output.grpc]
  core_address = "https://127.0.0.1:50051"
  batch_size = 500
  ```
- [ ] Metrics: compare share counts between v2 path and v3 path
- [ ] Network failure isolation: v3 gRPC failure must NOT affect v2-compat writes

**Deliverable:** Stratum sends every share to both v2 core (PostgreSQL) and v3 core (gRPC) simultaneously. v3 gRPC failures are isolated from production v2 path.

---

## Phase 5: Integration, Shadow Testing & Validation

**Duration:** 2–3 weeks  
**Goal:** Run both cores in parallel, compare results, validate correctness.

### Shadow Mode Architecture

```
 Miners (Stratum V1)
     │
     ▼
┌──────────────────────────────────┐
│  foundation-stratum (Rust)       │
│  mode = "dual"                   │
│                                  │
│  ├─→ v2-compat (PostgreSQL) ─────┼───→ v2 Core (ACTIVE — handles payments)
│  │                               │
│  └─→ gRPC forwarder ────────────┼───→ v3 Core (SHADOW — no payments)
└──────────────────────────────────┘

Comparison tool runs periodically:
  v2 current_balances vs v3 current_balances → diff?
  v2 current_miners vs v3 current_miners → diff?
  v3 worker_score_buckets populated correctly?
  v3 block_scores computed correctly on block confirmation?
```

### Tasks

- [ ] Deploy v3 core (shadow mode: processing enabled, payments DISABLED)
- [ ] Enable dual-output on Rust stratum in production
- [ ] Build comparison tool:
  - Connect to both v2 master DB and v3 DB
  - Compare miner balances (v2 round-based immature vs v3 PPLNT-scored immature)
  - Compare block records (v2 has round UUIDs, v3 has block_scores — compare totals)
  - Validate `worker_score_buckets` aggregation vs raw `share_archive` data
  - Validate `block_scores` payout percentages sum to 100%
  - Report discrepancies with full context
- [ ] Run shadow comparison for 48h+ minimum
- [ ] Investigate and fix any discrepancies (note: exact match with v2 not expected due to different scoring algorithms — validate v3 self-consistency)
- [ ] Block find scenarios:
  - Wait for natural block finds during shadow period
  - Verify v3 correctly creates `block_scores` at `generate` confirmation
  - Verify balance updates (immature → generate) match expected PPLNT distribution
- [ ] **Rapid successive blocks test:** if two blocks found close together:
  - v3 should score both independently via sliding window (overlapping share credit)
  - Compare with v2's approach (second round gets almost no shares)
  - Verify v3 is more equitable
- [ ] Competing block test (if possible to trigger with mock daemon):
  - Two stratum instances find blocks at same height
  - Verify v3 core resolves correctly (winner gets scored, loser orphaned — no round merge needed)
- [ ] End-to-end payment test (mock daemon):
  - v3 core: shares → blocks → confirmation → ScoringService → calculatePayouts → payment
  - Manual trigger: run payment processor against mock daemon
  - Verify correct amounts, correct recipients
- [ ] Multi-coin test (if second coin configured):
  - Shares routed to correct coin pipeline
  - Blocks, balances, payments isolated per coin
- [ ] Performance benchmarks:
  - Stratum: max connections, shares/sec throughput
  - Core ingestion: shares/sec via gRPC (multi-coin)
  - Core scoring: time to compute `block_scores` for various window sizes
  - API: requests/sec under load
- [ ] Replay test:
  - Process N hours of shares in v3 core
  - Corrupt v3 derived state (delete worker_score_buckets, block_scores)
  - Replay from share_archive, rescore blocks
  - Verify state matches original
- [ ] API compatibility test:
  - Point frontend at v3 API
  - Compare responses with v2 API for same queries
- [ ] Docker Compose full-stack deployment test

### Performance Targets

| Metric | Target | Current (estimated) |
|---|---|---|
| Max concurrent connections | 10,000+ | ~1,000 (Node.js cluster) |
| Share ingestion throughput | 50,000/sec | ~5,000/sec |
| Share processing (scoring) | 10,000/sec | ~2,000/sec |
| API response time (p99) | < 50ms | ~200ms |
| Memory usage (stratum, 1k connections) | < 100 MB | ~500 MB |
| Memory usage (core, idle) | < 200 MB | ~300 MB |

### Deliverable

Shadow mode running for 1+ week. v3 core produces identical results to v2 core. Zero discrepancies. Payment logic verified with mock daemon. Performance targets met.

---

## Phase 6: Migration & Cutover

**Duration:** 2–3 weeks  
**Goal:** Switch from v2 core to v3 core with zero downtime and zero payment disruption.

### Cutover Sequence

```
Step 1: v3 core confirmed accurate (Phase 5 complete)

Step 2: Data migration
  - Export final v2 state (blocks, balances, historical data)
  - Import into v3 schema
  - v3 core has both shadow-processed data AND imported v2 history

Step 3: Payment freeze
  - Disable v2 payments (short window — 1 hour)
  - Let v2 core finish any in-flight payment processing
  - Final balance sync: v2 balances → v3 balances

Step 4: Switchover
  - Stratum: switch output mode from "dual" to "grpc" only
  - v3 core: enable payments
  - v2 core: stop processing (keep DB accessible for rollback)
  - API: point DNS/proxy to v3 API

Step 5: Validation (24h)
  - Monitor: share ingestion, share processing, block detection
  - Monitor: first payment cycle completes correctly
  - Keep v2 on standby

Step 6: Cleanup
  - Remove v2-compat output code from stratum (or just leave disabled)
  - Decommission v2 worker-local PostgreSQL
  - Archive v2 master database
  - Update documentation
```

### Tasks

- [ ] Data migration scripts:
  - Export current block/round/balance/payment state from v2
  - Import into v3 schema (type conversions: FLOAT → NUMERIC, `type` → `coin_type`)
  - Verify data integrity post-migration
- [ ] Balance reconciliation tool:
  - Compare v2 balances with v3 shadow balances
  - Identify and resolve any differences before cutover
- [ ] Payment freeze procedure:
  - Documented steps for disabling v2 payments
  - Time estimate for final balance sync
- [ ] DNS/port cutover plan:
  - API DNS switch to v3
  - Health check verification
- [ ] Rollback plan:
  - Stratum: switch back to "v2-compat" mode (single config change)
  - Re-enable v2 core
  - DNS: point API back to v2
  - Estimated rollback time: < 5 minutes
- [ ] Monitoring setup:
  - Grafana dashboards for stratum metrics (connections, shares/sec, WAL depth)
  - Grafana dashboards for core metrics (processing throughput, payment status)
  - Alerting: WAL depth > threshold, processing lag, payment failures
- [ ] Documentation:
  - Operator runbook (startup, shutdown, config changes)
  - Troubleshooting guide
  - API documentation (generated from OpenAPI)
- [ ] Miner communication: announce maintenance window if needed (though switchover should be transparent to miners)

### Deliverable

v3 running in production. First payment cycle completed successfully. v2 on standby for 1 week. Monitoring confirms stable operation.

---

## Phase Summary

| Phase | Duration | Deliverable |
|---|---|---|
| **1. Scaffolding** | 1–2 weeks | Monorepo, proto contract, CI, GhostRider FFI spike |
| **2. Rust Stratum (V1, multi-coin)** | 5–7 weeks | Production stratum serving all miners (V1), multi-coin, v2 core unchanged |
| **3. Core Server (TypeScript, true PPLNT)** | 6–8 weeks | Complete core with gRPC, true PPLNT scoring, API, replay+rescore |
| **4. gRPC Forwarder** | 1–2 weeks | Dual-output mode (v2-compat + gRPC) |
| **5. Shadow Testing** | 2–3 weeks | Parallel comparison, PPLNT scoring validation, payment verification |
| **6. Cutover** | 2–3 weeks | v3 in production, v2 retired |
| **Total** | **17–23 weeks** | |

### Critical Path

```
Phase 1 ──→ Phase 2 ──→ [PRODUCTION: Rust stratum live]
                    ╲
                     ╲──→ Phase 3 (can overlap with Phase 2 production validation)
                              │
                              ▼
                         Phase 4 ──→ Phase 5 ──→ Phase 6
```

Phases 2 and 3 can overlap: once the Rust stratum is in production validation (Phase 2e), you can start building the core server (Phase 3) in parallel.

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| GhostRider FFI complexity | Stratum can't validate shares | Phase 1 includes FFI spike — fail fast before committing |
| Multi-coin algorithm plugin bugs | Wrong share validation for non-GhostRider coins | Each algorithm has test vectors; new coins deployed one at a time with monitoring |
| v2-compat output mismatch | v2 core rejects Rust stratum shares | Integration test in Phase 2c writes shares and verifies v2 core processes them |
| Miner software incompatibility | Miners disconnect from Rust stratum | Phase 2e gradual rollout — test with subset of miners first |
| Payment logic regression | Miners paid incorrectly | Shadow mode (Phase 5) catches discrepancies; mock daemon payment validation |
| PPLNT scoring window edge cases | Incorrect payouts on rapid blocks or long idle periods | Extensive unit tests with synthetic share patterns; replay tool for verification |
| PPLNT scoring performance | Slow scoring on large windows | `worker_score_buckets` pre-aggregation reduces query load; benchmark in Phase 5 |
| Performance shortfall | Can't handle current miner load | Performance targets benchmarked in Phase 5; production validation in Phase 2e |
| Competing block corruption | Incorrect balance state | Simplified with true PPLNT — no round merge needed; independent scoring per block |
| PostgreSQL archive growth | Disk pressure | pg_partman auto-manages partitions; daily pg_dump backups; drop after 3 months |
| gRPC reliability under load | Share forwarding stalls | Local WAL absorbs; backpressure via batch sizing; v2-compat fallback |
| Shadow mode discrepancies | Can't prove v3 correctness | v3 vs v2 won't match exactly (different algorithms); validate v3 self-consistency instead |
| Cutover payment gap | Miners miss a payment cycle | Payment freeze window is short (1h); communicated in advance |
