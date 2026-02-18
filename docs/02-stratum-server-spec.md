# Foundation v3 — Stratum Server Specification

## Overview

`foundation-stratum` is a high-performance mining server written in Rust. Its responsibilities are:

1. Accept and manage miner connections via **Stratum V1** (JSON-RPC/TCP)
2. Validate wallet addresses on connect (reject invalid format)
3. Serve block templates (jobs) from coin daemon(s)
4. Validate submitted shares against difficulty targets
5. Submit valid blocks to the coin daemon
6. Persist every valid share to a local SQLite WAL
7. Forward shares to the downstream consumer via a **pluggable output backend**:
   - **v2-compat:** Write to existing v2 worker-local PostgreSQL (for migration)
   - **gRPC:** Forward via gRPC to the v3 core server (final state)
   - **dual:** Both simultaneously (for shadow testing)

It supports **multiple coins and algorithms** simultaneously via coin profile configuration, and does **not** handle rounds, payments, statistics, or API serving — those are the core server's domain.

> **Note:** Stratum V2 (Noise-encrypted binary framing) is deferred to a future release. The initial release is V1-only.

---

## Protocol Support

### Stratum V1 (JSON-RPC/TCP)

Standard JSON-RPC over TCP/TLS, as currently implemented. Methods:
- `mining.subscribe`, `mining.authorize`, `mining.submit`
- `mining.set_difficulty`, `mining.notify` (server → client)

> Stratum V2 support is deferred to a future release. The internal architecture is designed to allow adding V2 listeners alongside V1 without changes to the mining engine.

## Connection Lifecycle (Stratum V1)
Miner connects (TCP or TLS)
    │
    ▼
┌─────────────────────────────────┐
│ State: CONNECTED                │
│ Waiting for mining.subscribe   │
└──────────┬──────────────────────┘
           │ mining.subscribe
           ▼
┌─────────────────────────────────┐
│ State: SUBSCRIBED               │
│ Returns: subscription IDs,     │
│          extranonce1, n2_size   │
│ Waiting for mining.authorize   │
└──────────┬──────────────────────┘
           │ mining.authorize (address.worker, password)
           ▼
┌─────────────────────────────────┐
│ State: AUTHORIZED               │
│ Parse: miner address, worker   │
│ Send: mining.set_difficulty    │
│ Send: mining.notify (first job)│
│ Start: VarDiff tracking        │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ State: MINING                   │
│ Receives: mining.submit        │◄──── mining.notify (new jobs)
│ Sends: share result (T/F)      │◄──── mining.set_difficulty (VarDiff)
│                                 │
│ On idle timeout: disconnect    │
│ On ban threshold: disconnect   │
└─────────────────────────────────┘
```

### Authorization Format

Miners authorize with `address.workerName` as the username:

```
mining.authorize("RGY1sRzh...7r.rig01", "x")
                  ^^^^^^^^^^^^^^^^ ^^^^
                  miner address    worker name
```

If no `.worker` suffix, worker defaults to `"default"`. The password is ignored (standard pool convention).

### Solo vs Shared Detection

Determined by the port the miner connects on. Each port in the config specifies `type = "solo"` or `type = "shared"`. This flag is attached to every share from that connection.

---

## Multi-Coin & Multi-Algorithm Architecture

A single `foundation-stratum` binary serves **multiple coins and algorithms simultaneously**. Each coin is defined as a **coin profile** in configuration, and ports are bound to specific coin profiles.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  foundation-stratum (single process)          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Coin Profile Manager                                   │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │ raptoreum    │  │ bitcoin      │  │ litecoin     │ │  │
│  │  │ algo: gr     │  │ algo: sha256d│  │ algo: scrypt │ │  │
│  │  │ daemon: :340 │  │ daemon: :832 │  │ daemon: :933 │ │  │
│  │  │ ports: 3333, │  │ ports: 3335  │  │ ports: 3337  │ │  │
│  │  │   3334, 4010 │  │              │  │              │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │  │
│  │         │                 │                 │          │  │
│  └─────────┼─────────────────┼─────────────────┼──────────┘  │
│            │                 │                 │             │
│  ┌─────────▼─────────────────▼─────────────────▼──────────┐  │
│  │ Shared Runtime                                          │  │
│  │  • TCP/TLS listener (all ports)                         │  │
│  │  • Connection router (port → coin profile)              │  │
│  │  • Protocol: V1 JSON-RPC (V2 deferred)                  │  │
│  │  • SQLite WAL (shared, tagged per coin)                 │  │
│  │  • Output backends                                      │  │
│  │  • Metrics server                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Coin Profile

Each coin profile encapsulates everything needed to mine a specific coin:

```rust
pub struct CoinProfile {
    pub name: String,              // "raptoreum"
    pub symbol: String,            // "RTM"
    pub algorithm: AlgorithmId,    // "ghostrider"
    pub daemon: DaemonConfig,      // RPC connection to coin daemon
    pub pool_address: String,      // Pool's receiving address for this coin
    pub recipients: Vec<Recipient>,// Fee recipients
    pub coin_type: String,         // "primary" (v2-compat)
    
    // Runtime components (per-coin):
    pub job_manager: JobManager,
    pub template_client: TemplateClient,
}
```

### Algorithm Plugin System

Hash algorithms are loaded dynamically via FFI, enabling new coins without recompilation:

```rust
pub trait HashAlgorithm: Send + Sync {
    /// Compute hash of the given header/data
    fn hash(&self, input: &[u8]) -> [u8; 32];
    
    /// Algorithm name (for logging/metrics)
    fn name(&self) -> &str;
    
    /// Whether the algorithm uses rotation multipliers (e.g., GhostRider)
    fn has_rotations(&self) -> bool { false }
    
    /// Get difficulty multiplier for a specific rotation
    fn rotation_multiplier(&self, _rotation: &str) -> f64 { 1.0 }
}

// Built-in algorithms
struct Sha256d;          // Bitcoin, BCH, BSV
struct Scrypt;           // Litecoin, Dogecoin
struct Ethash;           // ETC
struct RandomX;          // Monero
struct KawPow;           // Ravencoin
struct GhostRider;       // Raptoreum (loaded via FFI from gr.so)

// FFI-loaded algorithm
struct FfiAlgorithm {
    lib: Library,        // libloading handle
    hash_fn: Symbol<fn(*const u8, usize, *mut u8)>,
}
```

### Port → Coin Routing

When a miner connects, the listening port determines the coin profile:

```rust
// On connection accept:
let coin_profile = config.port_to_coin.get(&local_port)
    .ok_or_else(|| Error::UnknownPort(local_port))?;

// All subsequent operations (job distribution, share validation, 
// block submission) use this coin profile
let conn = Connection::new(stream, coin_profile.clone());
```

### Configuration (Multi-Coin)

```toml
# foundation-stratum.toml

[general]
identifier = "europe-01"
log_level = "info"
metrics_bind = "0.0.0.0:9100"

# ─── Coin Profiles ────────────────────────────────────────

[[coins]]
name = "Raptoreum"
symbol = "RTM"
algorithm = "ghostrider"
pool_address = "RGY1sRzhW7bpoYV2L9PMxTRjXqBQBTRN"
coin_type = "primary"

[coins.daemon]
host = "127.0.0.1"
port = 34001
username = "rpcuser"
password = "rpcpass"
poll_interval_ms = 1000

[coins.algorithm_config]
library = "libgr.so"
[coins.algorithm_config.rotations]
DarkDarkliteFast = 0.95
DarkDarkliteLite = 1.4
# ... all 20 rotations

[coins.recipients]
"RPoolFee..." = 0.01

[[coins]]
name = "Bitcoin"
symbol = "BTC"
algorithm = "sha256d"
pool_address = "bc1q..."
coin_type = "primary"

[coins.daemon]
host = "127.0.0.1"
port = 8332
username = "btcrpc"
password = "btcrpcpass"
poll_interval_ms = 500

[coins.recipients]
"bc1qfee..." = 0.02

# ─── Ports (bound to coin profiles by name) ──────────────

[[ports]]
port = 3333
coin = "Raptoreum"
type = "shared"
tls = false
[ports.difficulty]
initial = 0.2
minimum = 0.1
maximum = 10.0
target_time_s = 25
retarget_time_s = 5
variance = 0.05

[[ports]]
port = 4010
coin = "Raptoreum"
type = "solo"
tls = false
[ports.difficulty]
initial = 0.2
minimum = 0.1
maximum = 10.0
target_time_s = 25
retarget_time_s = 5
variance = 0.05

[[ports]]
port = 3335
coin = "Bitcoin"
type = "shared"
tls = false
[ports.difficulty]
initial = 65536
minimum = 32768
maximum = 4294967296
target_time_s = 10
retarget_time_s = 5
variance = 0.05
```

### Merge Mining (Future)

The architecture supports merge mining (auxiliary coins mined alongside a primary coin) by adding auxiliary coin profiles to a primary coin's configuration:

```toml
[[coins]]
name = "Namecoin"
symbol = "NMC"
algorithm = "sha256d"
coin_type = "auxiliary"
merge_mine_with = "Bitcoin"  # Shares from Bitcoin ports also validate against NMC

[coins.daemon]
host = "127.0.0.1"
port = 8336
# ...
```

---

## Job Management

### Block Template Polling

```
┌─────────────┐  getblocktemplate   ┌─────────┐
│ Job Manager │ ◄──────────────────│  Daemon  │
│             │    (RPC, every Ns) │  (RPC)   │
│  active_job │                    └─────────┘
│  job_map    │
│  (id→job)   │──── mining.notify ───► All miners
└─────────────┘
```

- Poll daemon via `getblocktemplate` RPC at configurable interval (default: 1000ms)
- Also support ZMQ `hashblock` notifications for instant new-block detection
- On new template: generate job, broadcast `mining.notify` to all connections
- Maintain a map of recent job IDs for share validation (reject submissions for expired jobs = "job not found")
- Job expiration: keep last N jobs (configurable, default: 4)

### Job Fields (mining.notify)

```json
["job_id", "prevhash", "coinb1", "coinb2", "merkle_branches", 
 "version", "nbits", "ntime", "clean_jobs"]
```

### Extranonce Management

- `extranonce1`: unique per connection (4 bytes), assigned at subscribe
- `extranonce2_size`: configurable (default: 4 bytes)
- Ensure no extranonce1 collisions across concurrent connections

---

## Share Validation

### Validation Steps

```
mining.submit(worker, job_id, extranonce2, ntime, nonce)
    │
    ├── 1. Job exists? (lookup job_id in job_map)
    │       └── No → reject ("job not found", mark as STALE)
    │
    ├── 2. Duplicate check? (extranonce1 + extranonce2 + ntime + nonce)
    │       └── Yes → reject ("duplicate share")
    │
    ├── 3. ntime valid? (within acceptable range of job ntime)
    │       └── No → reject ("ntime out of range")
    │
    ├── 4. Compute block header hash
    │       └── Algorithm-specific: GhostRider, SHA256d, Scrypt, etc.
    │       └── Loaded via FFI from shared library (.so)
    │
    ├── 5. Hash meets client difficulty target?
    │       └── No → reject ("low difficulty share")
    │
    ├── 6. Hash meets block difficulty target?
    │       ├── Yes → BLOCK FOUND
    │       │   └── Submit block to daemon (submitblock RPC)
    │       │   └── Create BlockFound record
    │       └── No → valid share (not a block)
    │
    └── 7. Record share
            ├── Write to SQLite WAL (fsync)
            └── ACK to miner (share accepted)
```

### Algorithm Plugin System

Hash functions are loaded at runtime as shared libraries:

```rust
// algorithms/mod.rs
pub trait HashAlgorithm: Send + Sync {
    fn hash(&self, input: &[u8], params: &HashParams) -> [u8; 32];
    fn name(&self) -> &str;
    fn multiplier(&self) -> f64;  // for hashrate calculation (2^32 / multiplier)
}

// algorithms/ffi.rs — loads .so files
pub struct FfiAlgorithm {
    lib: libloading::Library,
    hash_fn: Symbol<extern "C" fn(*const u8, usize, *mut u8, *const u8, usize)>,
}
```

For GhostRider specifically:
- Load `gr.so` (the existing shared library from v2)
- GhostRider uses CryptoNight rotation tables → pass rotation config via `HashParams`
- The rotation multipliers from the pool config are used for difficulty adjustments

---

## VarDiff (Variable Difficulty)

Retargets miner difficulty to maintain a steady share submission rate.

### Algorithm

```
On each share submission:
    1. Record submission timestamp
    2. Calculate average time between last N shares
    3. If avg_time < target_time * (1 - variance):
         → Increase difficulty (shares coming too fast)
    4. If avg_time > target_time * (1 + variance):
         → Decrease difficulty (shares coming too slow)
    5. Clamp to [minimum, maximum] difficulty
    6. If difficulty changed:
         → Send mining.set_difficulty
         → New difficulty takes effect on next job
```

### Configuration (per port)

```toml
[ports.3333.difficulty]
initial = 0.2        # Starting difficulty for new connections
minimum = 0.1        # Floor
maximum = 10.0       # Ceiling
target_time_s = 25   # Target seconds between shares
retarget_time_s = 5  # How often to recalculate
variance = 0.05      # Tolerance band (5%)
```

### Retarget Timing

Don't retarget on every share — accumulate a window of `retarget_time_s` worth of shares before recalculating. This prevents oscillation.

---

## Miner Banning

### Logic

```
Per IP address, maintain:
    valid_count: u64
    invalid_count: u64
    
On each share:
    if valid: valid_count += 1
    if invalid: invalid_count += 1
    
Every purge_interval:
    for each ip:
        total = valid_count + invalid_count
        if total >= check_threshold:
            invalid_pct = invalid_count * 100 / total
            if invalid_pct >= invalid_percent:
                BAN ip for ban_length
            reset counters
```

### Configuration

```toml
[banning]
ban_length_s = 600        # 10 minutes
check_threshold = 500     # Minimum shares before evaluating
invalid_percent = 50      # Ban if 50%+ invalid
purge_interval_s = 300    # Check every 5 minutes
```

### Banned Miner Handling

Banned IPs have their TCP connections immediately closed. New connections from the IP are rejected at the TCP accept level (before protocol parsing) to save resources.

**Ban scope:** Bans are **global across all coins**. An IP banned on one coin's port is banned on all ports. This prevents abusive miners from simply switching to a different coin's port.

---

## Address Validation

On `mining.authorize`, the stratum server validates the miner's wallet address format before accepting the connection:

```rust
fn validate_address(address: &str, coin: &CoinProfile) -> Result<()> {
    // Check length, character set, and prefix against coin-specific rules
    // e.g., Raptoreum addresses start with 'R' and are 34 chars base58
    coin.validate_address(address)?;
    Ok(())
}
```

Invalid addresses are rejected immediately with an error response. This prevents miners from wasting pool resources mining to invalid addresses that can never receive payouts.

Each `CoinProfile` defines its address validation rules (prefix, length, encoding).

---

## Hot Config Reload (SIGHUP)

The stratum server supports **SIGHUP-triggered hot configuration reload** without dropping miner connections:

**Reloadable settings:**
- Pool fee recipients and percentages
- VarDiff parameters (initial, min, max, target time, retarget time, variance)
- Banning thresholds
- Daemon RPC credentials

**Not reloadable (requires restart):**
- Listen ports
- Coin profiles (adding/removing coins)
- TLS certificates
- SQLite WAL path

```
SIGHUP received
    │
    ├── Read and validate new config file
    │       └── On error: log warning, keep old config
    │
    ├── Atomically swap config (Arc<RwLock<Config>>)
    │
    ├── Update VarDiff targets for all active connections
    ├── Update fee recipients
    ├── Update banning thresholds
    │
    └── Log "Config reloaded successfully"
```

---

## Pluggable Output Backend

The stratum server supports multiple output modes, configured at startup. This enables the **stratum-first migration strategy**: deploy the Rust stratum immediately with v2-compat output, then add gRPC when the v3 core is ready.

### Output Trait

```rust
// src/output/mod.rs

#[async_trait]
pub trait ShareOutput: Send + Sync + 'static {
    /// Write a validated share. Called from the share validation path.
    async fn write_share(&self, share: &ValidatedShare) -> Result<()>;
    
    /// Write a block found event. Called when a share solves a block.
    async fn write_block(&self, block: &BlockFound) -> Result<()>;
    
    /// Report network state. Called after each daemon poll.
    async fn report_network(&self, state: &NetworkState) -> Result<()>;
    
    /// Flush any buffered data. Called on graceful shutdown.
    async fn flush(&self) -> Result<()>;
    
    /// Name for logging/metrics.
    fn name(&self) -> &'static str;
}
```

### Output Modes

```toml
[output]
mode = "v2-compat"  # "v2-compat" | "grpc" | "dual"
```

| Mode | Description | When to use |
|---|---|---|
| `v2-compat` | Write to v2 worker-local PostgreSQL | Phase 2: replacing Node.js stratum while v2 core runs |
| `grpc` | SQLite WAL → gRPC → v3 core | Final state: v3 core is primary |
| `dual` | Both simultaneously | Phase 5: shadow testing (v2 active, v3 shadow) |

### v2-Compatible Output Backend

Writes shares directly to the existing v2 worker-local PostgreSQL database, matching the exact schema used by the current Node.js stratum. The v2 core picks up these shares on its normal polling interval — no changes to the v2 codebase required.

```rust
// src/output/v2_compat.rs
use sqlx::PgPool;

pub struct V2CompatWriter {
    pool: PgPool,
    coin_type: String,  // "primary" or "auxiliary"
}

impl V2CompatWriter {
    pub async fn new(config: &V2CompatConfig) -> Result<Self> {
        let pool = PgPool::connect(&config.database_url).await?;
        Ok(Self { pool, coin_type: config.coin_type.clone() })
    }
}

#[async_trait]
impl ShareOutput for V2CompatWriter {
    async fn write_share(&self, share: &ValidatedShare) -> Result<()> {
        // Matches: database/main/worker/local/shares.js
        sqlx::query(
            "INSERT INTO local_shares (
                uuid, timestamp, submitted, ip, port,
                addrprimary, addrauxiliary,
                blockdiffprimary, blockdiffauxiliary,
                blockvalid, blocktype,
                clientdiff, hash, height, identifier,
                reward, sharediff, sharevalid, transaction
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                      $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (uuid) DO NOTHING"
        )
        .bind(&share.uuid)
        .bind(share.timestamp as f64)               // v2 uses FLOAT8
        .bind(share.submitted as f64)
        .bind(&share.ip)
        .bind(share.port as i32)
        .bind(&share.addr_primary)
        .bind(&share.addr_auxiliary)                 // empty string if none
        .bind(share.block_diff_primary)              // FLOAT8 in v2
        .bind(share.block_diff_auxiliary)
        .bind(share.block_valid)                     // boolean
        .bind(&share.block_type)                     // "" unless block found
        .bind(share.client_diff)
        .bind(&share.hash)
        .bind(share.height as i64)
        .bind(&share.identifier)                     // stratum instance id
        .bind(share.reward)                          // FLOAT8 in v2
        .bind(share.share_diff)
        .bind(share.share_valid)                     // boolean
        .bind(&share.transaction)                    // "" unless block found
        .execute(&self.pool)
        .await?;
        
        Ok(())
    }
    
    async fn write_block(&self, block: &BlockFound) -> Result<()> {
        // Block info is embedded in the share row (blockvalid=true, transaction=...)
        // No separate block table in v2 worker-local DB — the v2 core's checks.js
        // creates the block record when it processes the share.
        // Nothing to do here.
        Ok(())
    }
    
    async fn report_network(&self, _state: &NetworkState) -> Result<()> {
        // v2 core handles network state from its own daemon polling
        Ok(())
    }
    
    async fn flush(&self) -> Result<()> {
        self.pool.close().await;
        Ok(())
    }
    
    fn name(&self) -> &'static str { "v2-compat" }
}
```

**v2-compat configuration:**

```toml
[output]
mode = "v2-compat"

[output.v2_compat]
# Same connection details as the current v2 worker-local DB
host = "127.0.0.1"
port = 5432
database = "foundation_local"
user = "foundation"
password = "..."
# Pool settings
min_connections = 2
max_connections = 10
```

### v2 Column Mapping

| Rust field | v2 column | Notes |
|---|---|---|
| `uuid` | `uuid` | UUID v4, TEXT PRIMARY KEY |
| `timestamp` | `timestamp` | Unix epoch as FLOAT8 |
| `submitted` | `submitted` | Unix epoch as FLOAT8 |
| `ip` | `ip` | Miner IP |
| `port` | `port` | Stratum port miner connected to |
| `addr_primary` | `addrprimary` | Miner's primary coin address |
| `addr_auxiliary` | `addrauxiliary` | Empty string if none |
| `block_diff_primary` | `blockdiffprimary` | Block difficulty as FLOAT8 |
| `block_diff_auxiliary` | `blockdiffauxiliary` | 0.0 if none |
| `block_valid` | `blockvalid` | true if share solves a block |
| `block_type` | `blocktype` | "" or "primary"/"auxiliary"/"share" |
| `client_diff` | `clientdiff` | Miner's current difficulty |
| `hash` | `hash` | Share hash hex string |
| `height` | `height` | Block height |
| `identifier` | `identifier` | Stratum instance identifier |
| `reward` | `reward` | Block reward as FLOAT8 |
| `share_diff` | `sharediff` | Share difficulty as FLOAT8 |
| `share_valid` | `sharevalid` | true if meets client diff target |
| `transaction` | `transaction` | Coinbase TX hex if block, else "" |

**Important:** The v2 database uses `FLOAT8` for numeric fields. The v2-compat writer intentionally writes FLOAT8 to match. The v3 core will use `NUMERIC(20,8)` — this conversion happens during the Phase 6 cutover.

### Dual Output Backend

Runs both outputs simultaneously. Used during shadow testing (Phase 5) to validate the v3 core against v2 production data.

```rust
// src/output/dual.rs
pub struct DualWriter {
    v2: V2CompatWriter,
    grpc: GrpcForwarder,
}

#[async_trait]
impl ShareOutput for DualWriter {
    async fn write_share(&self, share: &ValidatedShare) -> Result<()> {
        // v2 write is critical path — failures here affect production
        self.v2.write_share(share).await?;
        
        // gRPC write is best-effort — failures are logged but don't
        // fail the share. WAL guarantees eventual delivery to v3 core.
        if let Err(e) = self.grpc.write_share(share).await {
            tracing::warn!("gRPC shadow write failed (non-fatal): {e}");
        }
        
        Ok(())
    }
    // ... similar for write_block, report_network
}
```

**Dual mode configuration:**

```toml
[output]
mode = "dual"

[output.v2_compat]
host = "127.0.0.1"
port = 5432
database = "foundation_local"
user = "foundation"
password = "..."

[output.grpc]
core_address = "https://127.0.0.1:50051"
batch_size = 500
interval_ms = 1000
```

---

## SQLite WAL (Local Share Buffer)

> **Note:** The SQLite WAL is used by the **gRPC output backend** and the **dual output backend** to provide local durability for share forwarding. In **v2-compat mode**, the WAL is still used as an intermediary buffer between share validation and PostgreSQL writes, providing the same crash-safety guarantee.

### Schema

```sql
CREATE TABLE shares (
    uuid        TEXT PRIMARY KEY,
    timestamp   INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | forwarded
    forwarded_at INTEGER,
    data        BLOB NOT NULL  -- Protobuf-encoded Share message
);

CREATE INDEX idx_shares_status ON shares(status);
CREATE INDEX idx_shares_forwarded ON shares(forwarded_at) WHERE status = 'forwarded';

CREATE TABLE blocks (
    uuid        TEXT PRIMARY KEY,
    timestamp   INTEGER NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    forwarded_at INTEGER,
    data        BLOB NOT NULL  -- Protobuf-encoded BlockFound message
);
```

### Write Path

```rust
// Called BEFORE acknowledging share to miner
fn persist_share(&self, share: &Share) -> Result<()> {
    let data = share.encode_to_vec(); // Protobuf serialize
    self.db.execute(
        "INSERT OR IGNORE INTO shares (uuid, timestamp, status, data) VALUES (?1, ?2, 'pending', ?3)",
        params![share.uuid, share.timestamp, data],
    )?;
    Ok(())
}
```

### SQLite Configuration

```sql
PRAGMA journal_mode = WAL;         -- Write-Ahead Logging for concurrent read/write
PRAGMA synchronous = FULL;         -- Fsync on every commit (crash-safe)
PRAGMA wal_autocheckpoint = 1000;  -- Checkpoint every 1000 pages
PRAGMA busy_timeout = 5000;        -- Wait 5s on lock contention
```

### Retention

A background task periodically cleans forwarded shares:

```sql
DELETE FROM shares 
WHERE status = 'forwarded' 
  AND forwarded_at < ?1;  -- current_time - retention_hours
```

---

## gRPC Forwarder

### Responsibilities

1. Read pending shares from WAL in batches
2. Serialize to Protobuf ShareBatch
3. Send via gRPC `SubmitShares` call to core server
4. On success: mark as forwarded in WAL  
5. On failure: log, backoff, retry next cycle
6. Separate path for blocks: `SubmitBlock`
7. Separate path for network state: `ReportNetwork`

### Forwarding Loop

```rust
async fn forward_loop(&self) {
    let mut interval = tokio::time::interval(self.config.interval);
    let mut backoff = Duration::from_millis(self.config.interval_ms);
    
    loop {
        interval.tick().await;
        
        // Read batch from WAL
        let shares = self.wal.get_pending(self.config.batch_size)?;
        if shares.is_empty() {
            continue;
        }
        
        // Send via gRPC
        let batch = ShareBatch { shares: shares.clone() };
        match self.grpc_client.submit_shares(batch).await {
            Ok(ack) => {
                // Mark acknowledged shares as forwarded
                self.wal.mark_forwarded(&ack.accepted_uuids)?;
                backoff = Duration::from_millis(self.config.interval_ms);
            }
            Err(e) => {
                tracing::warn!("Forward failed: {e}, retry in {backoff:?}");
                tokio::time::sleep(backoff).await;
                backoff = (backoff * 2).min(Duration::from_secs(60));
            }
        }
    }
}
```

### Configuration

```toml
[forwarder]
core_address = "https://core.pool.example:50051"
batch_size = 500          # Shares per gRPC call
interval_ms = 1000        # Base send interval
max_backoff_s = 60        # Maximum retry backoff
tls_ca = "core-ca.crt"   # CA cert for core server verification
```

---

## Metrics (Prometheus)

Exposed at `GET /metrics` (HTTP, separate from stratum ports):

```
# Connection metrics
stratum_connections_active{port="3333"} 142
stratum_connections_total{port="3333"} 5839
stratum_connections_authorized{port="3333"} 140

# Share metrics
stratum_shares_valid_total{port="3333"} 982341
stratum_shares_invalid_total{port="3333"} 234
stratum_shares_stale_total{port="3333"} 1821

# Block metrics
stratum_blocks_found_total 3
stratum_blocks_submitted_total 3
stratum_blocks_accepted_total 2
stratum_blocks_rejected_total 1

# WAL metrics
stratum_wal_pending_count 0
stratum_wal_forwarded_count 1200
stratum_wal_total_size_bytes 45000000

# Forwarding metrics
stratum_forwarder_batches_sent_total 1542
stratum_forwarder_batches_failed_total 3
stratum_forwarder_shares_forwarded_total 771000
stratum_forwarder_last_ack_timestamp 1708200000

# VarDiff metrics
stratum_vardiff_adjustments_total{direction="up"} 342
stratum_vardiff_adjustments_total{direction="down"} 198

# Banning metrics
stratum_bans_active 2
stratum_bans_total 15

# Daemon metrics
stratum_daemon_poll_duration_seconds{quantile="0.99"} 0.045
stratum_daemon_height 1234567
stratum_daemon_difficulty 12345.67
```

---

## Configuration Reference

Full example configuration:

```toml
# foundation-stratum.toml

[general]
identifier = "europe-01"        # Instance identifier (sent with shares)
log_level = "info"              # trace, debug, info, warn, error
log_format = "json"             # json (production) or pretty (development)
metrics_bind = "0.0.0.0:9100"  # Prometheus metrics endpoint

[daemon]
host = "127.0.0.1"
port = 34001
username = "rpcuser"
password = "rpcpassword"
poll_interval_ms = 1000
zmq_enabled = false
zmq_host = "127.0.0.1"
zmq_port = 44001

[mining]
coin_name = "Raptoreum"
coin_symbol = "RTM"
algorithm = "ghostrider"
pool_address = "RGY1sRzhW7bpoYV2L9PMxTRjXqBQBTRN"
coin_type = "primary"           # primary or auxiliary

[mining.recipients]
# Pool fees
"RUpJX4qqB86guyFka49MxDxdJCHCnRzone" = 0.01   # 1%

[mining.algorithm]
library = "libgr.so"            # Hash algorithm shared library
# GhostRider-specific rotation multipliers
[mining.algorithm.rotations]
DarkDarkliteFast = 0.95
DarkDarkliteLite = 1.4
# ... (all 20 rotations)

[[ports]]
port = 3333
enabled = true
type = "shared"
tls = false
[ports.difficulty]
initial = 0.2
minimum = 0.1
maximum = 10.0
target_time_s = 25
retarget_time_s = 5
variance = 0.05

[[ports]]
port = 4444
enabled = true
type = "shared"
tls = true
[ports.difficulty]
initial = 0.2
minimum = 0.1
maximum = 10.0
target_time_s = 25
retarget_time_s = 5
variance = 0.05

[[ports]]
port = 4010
enabled = true
type = "solo"
tls = false
[ports.difficulty]
initial = 0.2
minimum = 0.1
maximum = 10.0
target_time_s = 25
retarget_time_s = 5
variance = 0.05

[banning]
ban_length_s = 600
check_threshold = 500
invalid_percent = 50
purge_interval_s = 300

[wal]
path = "/var/lib/foundation-stratum/shares.db"
retention_hours = 168           # 7 days after forwarding

[output]
mode = "v2-compat"              # v2-compat | grpc | dual

[output.v2_compat]
host = "127.0.0.1"
port = 5432
database = "foundation_local"
user = "foundation"
password = "..."
min_connections = 2
max_connections = 10

[output.grpc]                   # Used when mode = "grpc" or "dual"
core_address = "https://127.0.0.1:50051"
batch_size = 500
interval_ms = 1000
max_backoff_s = 60

[forwarder]
core_address = "https://127.0.0.1:50051"
batch_size = 500
interval_ms = 1000
max_backoff_s = 60

[tls]
cert = "certificates/server.crt"
key = "certificates/server.key"
ca = "certificates/rootCA.crt"

[timeouts]
connection_s = 600              # Idle connection timeout
rebroadcast_s = 60              # Job rebroadcast interval
```

---

## Crate Dependencies

```toml
[dependencies]
# Async runtime
tokio = { version = "1", features = ["full"] }

# TLS (V1 connections + gRPC)
tokio-rustls = "0.25"
rustls-pemfile = "2"

# gRPC (core server communication)
tonic = { version = "0.12", features = ["tls"] }
prost = "0.13"

# Local persistence
rusqlite = { version = "0.32", features = ["bundled"] }
sqlx = { version = "0.8", features = ["runtime-tokio", "tls-rustls", "postgres"] }  # v2-compat output

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"
toml = "0.8"

# Utilities
uuid = { version = "1", features = ["v4"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["json", "env-filter"] }
prometheus = "0.13"
hyper = { version = "1", features = ["http1", "server"] }
libloading = "0.8"              # FFI for hash algorithm .so files
sha2 = "0.10"
hex = "0.4"
dashmap = "6"                   # Concurrent hashmap for connections/channels
bytes = "1"
thiserror = "2"
anyhow = "1"
clap = { version = "4", features = ["derive"] }

[build-dependencies]
tonic-build = "0.12"
```
