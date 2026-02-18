# Foundation v3 — Architecture Overview

## Vision

Rewrite the Foundation mining pool as two independent, purpose-built packages:

1. **foundation-stratum** — A high-performance stratum server written in Rust
2. **foundation-core** — A pool management server written in TypeScript

Connected via gRPC with a local-first durability model that guarantees zero share loss.

---

## High-Level Architecture (Final State)

```
 Miners (Stratum V1 — JSON-RPC over TCP/TLS)
     │
     ▼
┌──────────────────────────────────────────────────────────┐
│              foundation-stratum (Rust)                    │
│                                                          │
│  ┌──────────────────────────────────┐                    │
│  │ Stratum V1 Listener (TCP/TLS)   │                    │
│  │  Per-port coin routing          │                    │
│  └──────────────┬───────────────────┘                    │
│                 ▼                                        │
│  ┌──────────────────────────────────┐                    │
│  │ Port → CoinProfile routing      │                    │
│  │  ┌─────────┐  ┌───────────────┐ │                    │
│  │  │ VarDiff │  │ Algorithm     │ │                    │
│  │  │ Engine  │  │ Plugin (.so)  │ │                    │
│  │  └─────────┘  └───────────────┘ │                    │
│  │  Share Validation → Mining Eng  │                    │
│  └──────────────┬───────────────────┘                    │
│                 ▼                                        │
│  ┌───────────────────────────────┐  ┌────────────────┐  │
│  │  SQLite WAL (local durable)  │  │  Daemon RPC    │  │
│  │  → Forwarder (batch gRPC)    │  │  (per coin)    │  │
│  └──────────────┬────────────────┘  └────────────────┘  │
└─────────────────┼────────────────────────────────────────┘
                  │
       gRPC (TLS, Protobuf)
       batched, compressed
                  │
                  ▼
┌──────────────────────────────────────────────────────────┐
│              foundation-core (TypeScript)                 │
│                                                          │
│  ┌──────────────────┐   ┌──────────────────────────────┐ │
│  │ gRPC Ingestion   │──>│ share_archive                │ │
│  │ Service          │   │ (append-only, immutable)     │ │
│  └────────┬─────────┘   └──────────────────────────────┘ │
│           │                                              │
│  ┌────────▼────────────────────────────────────────────┐ │
│  │ Processing Pipeline                                 │ │
│  │  ├── IngestionPipeline (archive + score_buckets)    │ │
│  │  ├── ScoringService   (continuous PPLNT window)     │ │
│  │  ├── BlockService     (confirmation checks)         │ │
│  │  ├── PaymentService   (miner payouts, per coin)     │ │
│  │  ├── StatisticsService(hashrate/efficiency)         │ │
│  │  └── MinerService     (miner/worker state)          │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌──────────────┐   ┌───────────────────────────────┐   │
│  │ REST API     │   │ PostgreSQL                    │   │
│  │ (Fastify)    │   │ (pool, NUMERIC, partitions,   │   │
│  │ + SSE push   │   │  worker_score_buckets,         │   │
│  └──────────────┘   │  block_scores)                │   │
│                     └───────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Replay + Rescore CLI                             │   │
│  │  foundation-core replay --from X --to Y --coin C │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Migration Architecture (Intermediate State)

The migration uses the **stratum-first strategy**: the Rust stratum server is built and deployed first with a v2-compatible output backend, while the existing v2 core continues running unchanged.

```
Phase 2: Rust stratum + v2-compat          Phase 4–5: Dual output (shadow)

 Miners                                     Miners
   │                                          │
   ▼                                          ▼
┌──────────────────┐                   ┌──────────────────┐
│ foundation-stratum│                  │ foundation-stratum│
│ (Rust)           │                   │ (Rust)           │
│                  │                   │                  │
│ output: v2-compat│                   │ output: dual     │
└────────┬─────────┘                   └──┬────────┬──────┘
         │                                │        │
    Same schema as                   v2-compat    gRPC
    current stratum                       │        │
         │                                ▼        ▼
         ▼                           ┌────────┐ ┌────────┐
┌──────────────────┐                 │v2 core │ │v3 core │
│ v2 Core (Node.js)│                 │(ACTIVE)│ │(SHADOW)│
│ UNCHANGED        │                 └────────┘ └────────┘
└──────────────────┘
```

In v2-compat mode, the Rust stratum writes directly to the v2 worker-local PostgreSQL database using the exact same `local_shares` table schema. The v2 core picks up these shares on its normal polling interval — it doesn't know that they came from Rust instead of Node.js. This allows the stratum server to be validated in production before the v3 core even exists.

---

## Design Principles

### 1. Local-First Durability (Zero Share Loss)

Every share is written to a local SQLite WAL on the stratum server **before** acknowledgment to the miner. Shares are only deleted from the WAL after the core server explicitly acknowledges receipt. If the network is down, shares accumulate locally indefinitely.

### 2. Append-Only Archive (Full Replayability)

The core server writes every raw share to an immutable `share_archive` table before any processing. This archive is the source of truth. All derived state (scores, balances, statistics) can be recomputed from the archive at any time.

### 3. Separation of Concerns

| Responsibility | Owner |
|---|---|
| Mining protocol (Stratum V1) | foundation-stratum |
| TCP/TLS connection management | foundation-stratum |
| Multi-coin port routing | foundation-stratum |
| Share/block hash validation | foundation-stratum |
| Algorithm plugin loading (FFI) | foundation-stratum |
| Difficulty retargeting (VarDiff) | foundation-stratum |
| Block template management (per coin) | foundation-stratum |
| Block submission to daemon | foundation-stratum |
| Miner banning (global IP ban) | foundation-stratum |
| Wallet address validation (on connect) | foundation-stratum |
| Local share buffering (WAL) | foundation-stratum |
| Share forwarding (gRPC) | foundation-stratum |
| SIGHUP hot config reload | foundation-stratum |
| Share archival | foundation-core |
| Share ingestion + score bucketing | foundation-core |
| Continuous PPLNT scoring | foundation-core |
| Block confirmation tracking | foundation-core |
| Payment processing (batched sendmany) | foundation-core |
| Statistics computation | foundation-core |
| Miner/worker state | foundation-core |
| REST API + SSE push events | foundation-core |
| Email notifications (SMTP) | foundation-core |
| Replay/rescore/recovery tools | foundation-core |

### 4. Algorithm Agnosticism

The stratum server supports pluggable algorithm backends via the `HashAlgorithm` trait. Hash validation functions can be:
- **Built-in:** Sha256d, Scrypt, GhostRider (compiled into the binary)
- **FFI plugins:** Any algorithm loaded as a shared library (`.so`/`.dll`) via `libloading`

New coins are supported by adding a `CoinProfile` in config and optionally providing an algorithm `.so` — no recompilation required.

### 5. Multi-Coin, Multi-Algorithm

A single stratum binary serves **multiple coins simultaneously** via port-based routing:
- Each `[[ports]]` entry maps to a specific `[[coins]]` profile
- Each coin has its own daemon RPC, algorithm, pool address, and fee recipients
- Independent job sequences, block templates, and VarDiff per coin
- Some coins support merge mining (primary + auxiliary); others are independent
- The core server processes all coins in the same pipeline, differentiated by `coin` field

> **Note:** Stratum V2 (Noise-encrypted binary framing) is deferred to a future release. The initial release is V1-only.

---

## Data Flow

### Share Lifecycle

**v3 final (gRPC mode):**
```
1. Miner submits share via Stratum V1 protocol
2. Port routing selects CoinProfile + HashAlgorithm
3. Stratum server validates hash against target difficulty
4. Valid share → INSERT into local SQLite WAL (fsync'd)
5. If share solves a block → submit block to coin daemon via RPC
6. ACK share to miner ("share accepted")
7. Background forwarder batches shares from WAL
8. gRPC SubmitShares → core server (includes coin field)
9. Core writes raw share to share_archive (append-only)
10. Core UPSERTs worker_score_buckets (5-min pre-aggregated PPLNT scoring)
11. Core updates hashrate, miner/worker state
12. Core sends ShareAck with accepted UUIDs
13. Stratum marks shares as forwarded in WAL
14. After retention period, forwarded shares are purged from WAL
```

**v2-compat mode (during migration):**
```
1. Miner submits share via Stratum V1 protocol
2. Stratum server validates hash against target difficulty
3. Valid share → INSERT into local SQLite WAL (fsync'd)
4. If share solves a block → submit block to daemon via RPC
5. ACK share to miner
6. Background writer inserts shares from WAL into v2 worker-local PostgreSQL
   (local_shares table with exact same schema as current Node.js stratum)
7. v2 Core picks up shares on its normal polling interval
8. On successful PostgreSQL insert, mark shares as forwarded in WAL
```

### Block Lifecycle (True PPLNT — No Rounds)

```
1. Stratum detects block solution → submits to coin daemon
2. Stratum sends BlockFound via gRPC → core server (includes coin field)
3. Core creates block record (category: pending)
4. If another pending block at same height+coin → mark both as competing
5. Periodic: Core checks coin daemon for confirmations
6. Competing blocks resolved: daemon confirms winner (loser → orphan)
7. pending/competing → immature → generate (confirmed) OR orphan
8. If orphan: reverse any immature balance credits
9. If generate: ScoringService computes continuous PPLNT window scores
   - Query worker_score_buckets in [blockTimestamp - windowSeconds, blockTimestamp]
   - Score: S_m = Σ(bucket.time_score) per miner
   - Payout: pct_m = S_m / Σ(S_all), apply pool fee, multiply by reward
   - Store immutable distribution in block_scores table
10. Update miner balances based on block_scores
11. PaymentService sends on-chain transaction (per coin daemon)
12. Balances settled, block archived to historical tables
```

### Data Retention

| Layer | Location | Retention | Purpose |
|---|---|---|---|
| Stratum local WAL | SQLite on stratum server | 7 days post-ACK | Network outage survival |
| Core share_archive | PostgreSQL (partitioned) | 3 months hot, then dropped | Replay, audit, disputes |
| Derived state | PostgreSQL (current_*) | Live | Normal operations |
| Historical state | PostgreSQL (historical_*) | Indefinite | API, dashboards |
| DB backups | Daily pg_dump + rotation | 7 days | Disaster recovery |

---

## Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Stratum server | Rust 2024 edition (MSRV 1.85+) + Tokio | Async TCP, memory safety, zero-cost abstractions, C FFI for hash algorithms |
| Local WAL | SQLite (WAL mode) | Proven durability, zero-config, inspectable with standard tools |
| Transport | gRPC + Protobuf | Typed contracts, streaming, flow control, TLS built-in |
| Core server | TypeScript + Node.js 22 LTS | Rapid iteration on business logic, strong ecosystem (pg, grpc, fastify) |
| REST API | Fastify + SSE | Faster than Express, schema validation, OpenAPI generation, real-time push |
| Database | PostgreSQL 16+ | Partitioning, NUMERIC types, connection pooling, pg_partman |
| Connection pool | pg-pool | Multi-connection, prepared statements, transaction support |
| Logging | tracing (Rust) + pino (TS) | Configurable: JSON for production, text for development |
| Testing | Jest (TS), cargo test (Rust) | Mock daemon RPC responses; no testnet dependency |
| Schema migrations | TypeScript migration files | Programmatic control, data transforms, version-controlled |
| Containerization | Docker Compose | Dev environment, CI, production deployment |
| Monitoring | Prometheus + Grafana | /metrics endpoints on both services, dashboards |

---

## Repository Structure

```
foundation/
├── docs/                        # This documentation
├── proto/                       # Shared Protobuf definitions
│   └── stratum_ingest.proto
│
├── foundation-stratum/          # Rust crate (binary)
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── build.rs
│   ├── src/
│   │   ├── main.rs
│   │   ├── config/
│   │   ├── server/              # TCP listener, connection handler
│   │   ├── protocol/            # Stratum V1 JSON-RPC codec
│   │   ├── mining/              # Jobs, VarDiff, validation, banning
│   │   ├── coins/               # CoinProfile, port→coin routing
│   │   ├── daemon/              # Bitcoin RPC client, block templates (per coin)
│   │   ├── wal/                 # SQLite WAL manager
│   │   ├── output/              # Pluggable output backends
│   │   │   ├── mod.rs           # ShareOutput trait
│   │   │   ├── v2_compat.rs     # PostgreSQL writer (v2 schema)
│   │   │   ├── grpc.rs          # gRPC forwarder (v3 native)
│   │   │   └── dual.rs          # Both simultaneously
│   │   ├── forwarder/           # gRPC batch sender (used by grpc output)
│   │   └── algorithms/          # HashAlgorithm trait, FFI plugin loader
│   │       ├── mod.rs           # Trait + built-in (sha256d, scrypt)
│   │       ├── ghostrider.rs    # GhostRider FFI (gr.so)
│   │       └── ffi.rs           # Generic libloading plugin
│   └── tests/
│
├── foundation-core/             # TypeScript package
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts
│   │   ├── config/
│   │   ├── grpc/                # gRPC server (share ingestion)
│   │   ├── services/
│   │   │   ├── ingestion.ts     # IngestionPipeline (archive + score_buckets)
│   │   │   ├── scoring.ts       # ScoringService (continuous PPLNT window)
│   │   │   ├── blocks.ts        # BlockService (confirmation + scoring trigger)
│   │   │   ├── payments.ts      # PaymentService (per coin)
│   │   │   ├── statistics.ts    # StatisticsService
│   │   │   ├── network.ts       # NetworkService
│   │   │   └── miners.ts        # MinerService (state management)
│   │   ├── api/                 # Fastify REST API
│   │   ├── database/            # pg-pool, migrations, queries
│   │   ├── templates/           # Coin-specific logic (RPC calls)
│   │   ├── replay/              # Replay + rescore CLI tooling
│   │   └── utils/
│   └── tests/
│
├── docker-compose.yml           # PostgreSQL + dev services
├── Makefile                     # Top-level build/test/dev commands
└── README.md
```

---

## What's Changing vs Current System

| Aspect | Current (v2) | New (v3) |
|---|---|---|
| Language | JavaScript (Node.js) | Rust (stratum) + TypeScript (core) |
| Architecture | Monolith with cluster forks | Two independent services |
| Stratum protocol | V1 only (external npm packages) | V1 native (built into Rust binary). V2 deferred to future release |
| Multi-coin | Separate process per coin | Single binary, port-based routing, coin profiles |
| Algorithm support | Hardcoded per npm package | Pluggable `HashAlgorithm` trait + FFI `.so` plugins |
| Reward model | PPLNT with round boundaries | True PPLNT — continuous sliding window, no rounds |
| Round management | `current_rounds` table, round UUIDs | Eliminated — `worker_score_buckets` + `block_scores` |
| Share transport | Local PostgreSQL → master PostgreSQL | SQLite WAL → gRPC → PostgreSQL |
| Share archival | None (shares deleted after aggregation) | Immutable append-only archive |
| SQL queries | String interpolation (injection risk) | Parameterized queries ($1, $2) |
| Financial precision | FLOAT | NUMERIC(20,8) |
| DB connections | Single pg.Client | Connection pool (pg-pool) |
| API framework | Express | Fastify |
| Error handling | Callback hell, silent failures | async/await, structured errors |
| Code duplication | Primary/Auxiliary copy-paste | Parameterized coin-type handling |
| Endpoint validation | 988 lines of boilerplate | Schema-driven (Fastify JSON Schema) |
| Shutdown | Crash-restart (2s delay) | Graceful (drain connections, flush WAL) |
| Replay/recovery | Not possible | Full replay from share archive + rescore |
| Testing | Jest only | Jest (TS) + cargo test (Rust) |
| Schema management | Runtime CREATE IF NOT EXISTS | Version-controlled migrations |
