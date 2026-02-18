# Foundation v3 — True PPLNT Reward Design

## Problem Statement

### v2's Round-Delimited PPLNT

The current v2 system uses **round-delimited PPLNT**: shares are grouped into "rounds" that start and end at block boundaries. When a block is found, all `round='current'` shares are stamped with that block's UUID, effort/work counters are reset, and a new round begins.

This creates a critical fairness problem:

```
Time (minutes)    0    5    10   15   20   25   30
                  │    │    │    │    │    │    │
Miner A (100 TH): ═════════════════════════════════  (steady 30 min)
Miner B (50 TH):  ═══════════                        (10 min burst)
                              ▲         ▲
                          Block 1    Block 2
                          (10 min)   (20 min)
```

**Round 1 (0–10 min):**
Miner A has 10 min of time × 100 TH of work. Miner B has 10 min × 50 TH. Reward split ≈ 66/33.

But Block 2 comes only 10 minutes after Block 1:

**Round 2 (10–20 min):**
Miner A has 10 min × 100 TH. Miner B has 0 (left at minute 10). Miner A gets 100%.

If Miner B was present for 10 of the last 20 minutes before Block 2, they should get credit for their contribution to the pool's hashrate during the relevant scoring window — not zero because a round boundary happened to fall right when they stopped.

### The Rapid Successive Blocks Problem

When two blocks are found within seconds/minutes of each other:
- Round 2 between them captures almost no shares
- Work distribution is wildly unrepresentative of actual contributions
- A miner who submits a burst of high-difficulty shares right before a block can disproportionately benefit
- An honest miner mining steadily gets penalized by the arbitrary round boundary

### What "True PPLNT" Means

**True PPLNT** (Pay Per Last N Time) eliminates round boundaries entirely. Instead of per-round accounting, reward distribution uses a **continuous scoring window** that looks back N minutes from the block's timestamp, regardless of how many other blocks were found in that window.

---

## Design: Continuous Scoring Window

### Core Concept

When a block is found at time $T$, the reward is distributed based on miner contributions during the window $[T - W, T]$, where $W$ is the configurable scoring window (default: 3,600–7,200 seconds = 1–2 hours, exact value TBD per coin).

```
                    Scoring Window (W)
    ◄─────────────────────────────────────►
    │                                     │
T-W ─────────────────────────────────── T (block found)
    │                                     │
    │  All shares in this window count    │
    │  toward reward distribution         │
    │                                     │
    │  Previous block times are IGNORED   │
    │  — no round boundaries              │
```

Multiple blocks can overlap in their scoring windows. Each block independently looks back $W$ seconds and calculates its own reward distribution. This means the same share can contribute to multiple block rewards — which is correct behavior, as the miner was providing hashrate to the pool during all those blocks' scoring windows.

### Time-Weighted Score

For each miner $m$ in the scoring window, their score $S_m$ is:

$$S_m = \sum_{i} d_i \cdot \Delta t_i$$

Where:
- $d_i$ is the share difficulty (client difficulty / share difficulty)
- $\Delta t_i = \min(t_i - t_{i-1}, T_{cap})$ is the time since the miner's previous share, capped at $T_{cap}$ (default: 900 seconds)
- The cap prevents idle miners from accumulating "phantom" time

The miner's reward share is:

$$R_m = \frac{S_m}{\sum_{k} S_k} \cdot B_{net}$$

Where $B_{net}$ is the block reward after pool fee deduction.

**Rounding:** Fractional payout amounts are truncated (floor) to 8 decimal places. The pool keeps the dust. This ensures the total distributed never exceeds the available reward.

### Why Time-Weighting Matters

Pure PPS (pay per share) only considers difficulty (`work`). A miner who submits 1000 shares in 1 second and disconnects gets the same reward as one who submits 1000 shares over 10 minutes. Time-weighting ensures that **consistent, continuous hashrate** is rewarded over burst mining.

The 900-second cap means: if you're not submitting shares (i.e., not actually mining), your time stops accumulating. This prevents a miner with a lucky high-diff share from "coasting" on it.

---

## Scoring Window Implementation

### share_archive as the Source of Truth

The `share_archive` table already stores every share with timestamps. Instead of maintaining mutable round-state tables, the scoring calculation reads directly from the archive.

```sql
-- Get all valid shares in the scoring window for a block found at time T
SELECT 
    miner,
    worker,
    share_diff,
    client_diff,
    submitted,
    solo
FROM share_archive
WHERE timestamp BETWEEN ($1 - $2) AND $1    -- $1=block_time, $2=window_size
  AND coin_type = $3
  AND valid = true
  AND solo = false                            -- solo miners not in shared pool
ORDER BY miner, worker, submitted;
```

### Score Computation (TypeScript)

```typescript
interface ScoringResult {
  scores: Map<string, Decimal>;   // miner → score
  totalScore: Decimal;
  windowStart: number;
  windowEnd: number;
  sharesProcessed: number;
}

async function computeScores(
  blockTime: number,
  windowSize: number,
  coinType: CoinType,
  timeCap: number = 900,
): Promise<ScoringResult> {
  const scores = new Map<string, Decimal>();
  let totalScore = new Decimal(0);
  let sharesProcessed = 0;

  // Stream shares from archive (memory-efficient for large windows)
  const cursor = db.query(SCORING_WINDOW_QUERY, [
    blockTime, windowSize, coinType
  ]);

  // Track last-share-time per worker for time-delta computation
  const lastSeen = new Map<string, number>();

      );
    } else {
      timeDelta = (share.submitted - lastTime) / 1000;  // ms → s
    }
    
    // Apply cap — idle periods don't count
    timeDelta = Math.min(timeDelta, timeCap);
    
    // Score = share_difficulty × capped_time_delta
    const shareScore = new Decimal(share.share_diff)
      .mul(new Decimal(timeDelta));
    
    const minerScore = scores.get(share.miner) ?? new Decimal(0);
    scores.set(share.miner, minerScore.add(shareScore));
    totalScore = totalScore.add(shareScore);
    
    lastSeen.set(workerKey, share.submitted);
    sharesProcessed++;
  }

  return { scores, totalScore, windowStart: blockTime - windowSize, 
           windowEnd: blockTime, sharesProcessed };
}
```

### Payment Calculation

```typescript
async function calculateBlockPayout(
  block: ConfirmedBlock
): Promise<PayoutPlan> {
  const { scores, totalScore } = await computeScores(
    block.submitted,  // Use block discovery time as anchor
    config.pplnt.windowSize,
    block.coinType,
  );

  const netReward = new Decimal(block.reward)
    .mul(new Decimal(1).sub(config.poolFee));  // After pool fee

  const payouts: PayoutEntry[] = [];
  for (const [miner, score] of scores) {
    const share = score.div(totalScore);
    const amount = netReward.mul(share).toDecimalPlaces(8, Decimal.ROUND_DOWN);  // floor (truncate)
    
    if (amount.gt(0)) {
      payouts.push({ miner, amount, share: share.toNumber() });
    }
  }

  return { block, payouts, totalScore, netReward };
}
```

---

## What Changes vs v2

### Removed Concepts

| v2 Concept | Status | Replacement |
|---|---|---|
| `current_rounds` table | **Removed** | Scoring reads from `share_archive` |
| `round = 'current'` / UUID | **Removed** | No round boundaries |
| Round transition on block | **Removed** | Each block scores independently via window |
| Effort/work reset on block | **Removed** | No accumulated state to reset |
| `handleBlock()` round UUID assignment | **Removed** | Block records exist independently |
| `processSegments()` | **Removed** | Share stream is continuous |
| `handleCurrentOrphans()` merge-back | **Simplified** | Orphan doesn't "destroy a round" — rewards just aren't paid |

### Kept Concepts

| Concept | Behavior |
|---|---|
| 900-second time cap | Worker gaps ≥ 900s don't accumulate time credit |
| Solo mining | Solo blocks only pay the solo miner (not scored via window) |
| Pool fee recipients | Per-coin + per-mode (solo vs shared), deducted from gross reward before distribution. Single recipient address per fee. |
| Per-user payout limits | Applied at payment time, not scoring time |
| Block confirmation flow | pending → immature → generate → paid (unchanged) |
| Competing block handling | Same dual-block resolution logic |

### What Happens to `current_rounds`?

`current_rounds` is **eliminated entirely** from the v3 schema. Its functions are replaced:

| Function | New Source |
|---|---|
| Per-worker work tracking | `share_archive` (queried on demand) |
| Per-worker time tracking | Computed from share timestamps in `share_archive` |
| Effort tracking | `current_metadata.effort` (accumulates continuously, no reset) |
| Hashrate source | `current_hashrate` (unchanged — append-only window) |

The `historical_rounds` table is replaced by `block_scores` — a snapshot of the scoring result for each confirmed block.

---

## New Database Tables

### block_scores (replaces historical_rounds)

Stores the computed payout distribution for each confirmed block. Created at `generate` time, immutable after.

```sql
CREATE TABLE block_scores (
    id              BIGSERIAL       PRIMARY KEY,
    block_id        BIGINT          NOT NULL REFERENCES current_blocks(id),
    miner           VARCHAR(128)    NOT NULL,
    score           NUMERIC(30,8)   NOT NULL,     -- raw time×work score
    share           NUMERIC(10,8)   NOT NULL,     -- fraction of total (0.0–1.0)
    amount          NUMERIC(20,8)   NOT NULL,     -- reward amount
    coin_type       VARCHAR(16)     NOT NULL DEFAULT 'primary',
    window_start    BIGINT          NOT NULL,     -- scoring window start timestamp
    window_end      BIGINT          NOT NULL,     -- = block submitted timestamp
    
    UNIQUE (block_id, miner, coin_type)
);

CREATE INDEX idx_block_scores_block ON block_scores (block_id);
CREATE INDEX idx_block_scores_miner ON block_scores (miner, coin_type);
```

### Effort Tracking

Effort no longer resets at round boundaries. Instead, it's tracked as a rolling (continuous) metric:

```sql
-- In current_metadata, effort now represents pool-wide running effort
-- Reset manually or on operator command, not on every block
-- "Luck" per block is calculated at block-find time as:
--   luck = (shares_since_last_block × avg_share_diff) / block_diff
```

Block luck is computed at block discovery time and stored in `current_blocks.luck`. The pool-wide effort in `current_metadata` serves only the dashboard/API, not reward calculations.

---

## Solo Mining

Solo mining is **unchanged**: the solo miner receives the full block reward (minus pool fee). Scoring windows don't apply — there's no time-weighted distribution because there's only one miner.

```typescript
if (block.solo) {
  // Simple: full reward to solo miner
  return {
    payouts: [{
      miner: block.miner,
      amount: netReward,
      share: new Decimal(1),
    }],
  };
}
```

---

## Performance Considerations

### Scoring Window Query Performance

The scoring window query against `share_archive` is the performance-critical path. With 1000 shares/sec and a 2h window, that's ~7.2M shares to scan.

**Optimizations:**

1. **Materialized per-worker summaries**: Instead of scanning raw shares, maintain a rolling summary table that pre-aggregates work and time per worker per time bucket (e.g., 5-minute buckets):

```sql
CREATE TABLE worker_score_buckets (
    bucket_time     BIGINT          NOT NULL,  -- floor(timestamp / 300) * 300
    miner           VARCHAR(128)    NOT NULL,
    worker          VARCHAR(128)    NOT NULL,
    coin_type       VARCHAR(16)     NOT NULL,
    solo            BOOLEAN         NOT NULL DEFAULT false,
    total_diff      NUMERIC(30,8)   NOT NULL DEFAULT 0,   -- sum of share_diff
    share_count     INT             NOT NULL DEFAULT 0,
    first_share     BIGINT          NOT NULL,
    last_share      BIGINT          NOT NULL,
    time_score      NUMERIC(30,8)   NOT NULL DEFAULT 0,   -- pre-computed Σ(diff × Δt)
    
    PRIMARY KEY (bucket_time, miner, worker, coin_type, solo)
);

CREATE INDEX idx_wsb_time ON worker_score_buckets (bucket_time, coin_type, solo);
```

With 5-minute buckets, the scoring query scans ~24 rows per miner for a 2-hour window, vs millions of raw share rows. The bucket table is updated incrementally as shares are ingested.

2. **Partition pruning**: `share_archive` is partitioned by timestamp. The scoring window query touches at most 2 partitions (current + previous month).

3. **Streaming cursor**: For raw-share scoring, use a PostgreSQL cursor to avoid loading millions of rows into memory.

4. **Caching**: Block rewards don't change after confirmation. Cache scoring results in `block_scores` so they're never recomputed.

---

## Configuration

```toml
[rewards]
scheme = "pplnt"                  # pplnt | pps | prop
window_seconds = 7200             # Scoring window (default: 2 hours, per-coin configurable)
time_cap_seconds = 900            # Max idle gap before time stops counting

# Pool fees are per-coin + per-mode (solo vs shared)
[rewards.fee]
shared = 0.01                     # 1% pool fee for shared mining
solo = 0.02                       # 2% pool fee for solo mining
recipient = "RTMyPoolFeeAddress..."  # Single fee recipient

[rewards.payout]
global_minimum = 1.0              # Global minimum payout (miners can set higher)
```

---

## Migration from v2 Rounds

During the Phase 6 cutover:
1. Historic round data in `current_rounds` and `historical_rounds` is archived (not migrated)
2. The `share_archive` becomes the sole source for all reward calculations
3. Any blocks still pending at cutover time will be scored using the new window method
4. The `block_scores` table starts empty and grows as blocks are confirmed

All future blocks use continuous scoring. Historic blocks keep their original v2 round-based payouts (no retroactive recomputation needed).
