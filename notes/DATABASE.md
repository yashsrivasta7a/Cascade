# Flowsmith Database Architecture

> A visual AI workflow automation platform - Database documentation for interview prep

## Quick Stats

| Metric | Value |
|--------|-------|
| **Total Tables** | 13 |
| **Database** | PostgreSQL 17 (Neon Serverless) |
| **Total Rows** | ~3,500 |
| **Users** | 5 |
| **Workflows** | 75 |

---

## Table Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLOWSMITH DATABASE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │   users     │ ◄─────────────────────────────────────────────┐            │
│  │   (5)       │                                               │            │
│  └──────┬──────┘                                               │            │
│         │ 1:many                                               │            │
│         ▼                                                      │            │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────┐ │            │
│  │  workflows  │───►│ workflow_versions│    │   api_keys     │◄┘            │
│  │    (75)     │    │      (84)        │    │     (11)       │              │
│  └──────┬──────┘    └──────────────────┘    └────────────────┘              │
│         │                                                                   │
│    ┌────┴────┬─────────────────┐                                            │
│    │         │                 │                                            │
│    ▼         ▼                 ▼                                            │
│ ┌────────┐ ┌────────┐ ┌───────────────────┐                                 │
│ │workflow│ │workflow│ │workflow_executions│                                 │
│ │_nodes  │ │_edges  │ │      (213)        │                                 │
│ │ (271)  │ │ (229)  │ └─────────┬─────────┘                                 │
│ └────────┘ └────────┘           │                                           │
│                                 │ 1:many                                    │
│                                 ▼                                           │
│                        ┌─────────────────┐                                  │
│                        │ node_executions │                                  │
│                        │     (924)       │                                  │
│                        └─────────────────┘                                  │
│                                                                             │
│  Standalone Tables:                                                         │
│  ┌─────────────────┐ ┌───────────────────┐ ┌──────────────────┐             │
│  │quick_executions │ │credit_transactions│ │ node_result_cache│             │
│  │     (369)       │ │     (1248)        │ │      (25)        │             │
│  └─────────────────┘ └───────────────────┘ └──────────────────┘             │
│                                                                             │
│  ┌─────────────────┐ ┌───────────────────┐                                  │
│  │workflow_templates│ │ provider_webhooks │                                  │
│  │      (2)        │ │       (0)         │                                  │
│  └─────────────────┘ └───────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Tables

### 1. `users` (5 rows)
**Purpose:** Store user accounts (synced from Clerk authentication)

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | Clerk user ID (primary key) |
| `email` | String | User's email (unique) |
| `credits` | Int | Credit balance (default: 1,000,000 = $1.00) |
| `createdAt` | DateTime | Account creation time |
| `updatedAt` | DateTime | Last update time |

**Key Points:**
- Credits are in micro-units (1,000,000 = $1.00)
- ID comes from Clerk, not auto-generated

---

### 2. `workflows` (75 rows)
**Purpose:** Store user-created AI workflows

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `userId` | String | Owner (FK to users) |
| `name` | String | Workflow name |
| `description` | String? | Optional description |
| `nodesJson` | JSON | Legacy: All nodes as JSON blob |
| `edgesJson` | JSON | Legacy: All edges as JSON blob |
| `viewportJson` | JSON? | Canvas position/zoom |
| `isNormalized` | Boolean | True if migrated to normalized tables |
| `version` | Int | Auto-incrementing version number |
| `isPublished` | Boolean | Public visibility flag |

**Key Points:**
- Dual storage: JSON blobs (legacy) + normalized tables (new)
- `isNormalized` flag tracks migration status
- Version increments on each save

---

### 3. `workflow_nodes` (271 rows) - NEW
**Purpose:** Normalized node storage for scalability (1000+ nodes)

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `workflowId` | String | FK to workflows |
| `nodeId` | String | React Flow node ID (e.g., "input-1") |
| `type` | String | Node type (e.g., "seedream", "openrouter") |
| `positionX` | Float | X coordinate on canvas |
| `positionY` | Float | Y coordinate on canvas |
| `dataJson` | JSON | Node config (label, settings) |
| `width` | Float? | Measured width |
| `height` | Float? | Measured height |
| `sortOrder` | Int | Execution order |

**Key Points:**
- Enables pagination (load 100 nodes at a time)
- Enables partial updates (move one node, update one row)
- Indexed by `workflowId`, `type`, `sortOrder`

---

### 4. `workflow_edges` (229 rows) - NEW
**Purpose:** Normalized edge storage for connections between nodes

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `workflowId` | String | FK to workflows |
| `edgeId` | String | React Flow edge ID |
| `source` | String | Source node's nodeId |
| `target` | String | Target node's nodeId |
| `sourceHandle` | String? | Output handle name |
| `targetHandle` | String? | Input handle name |

**Key Points:**
- Unique constraint on (workflowId, source, target, handles)
- Indexed for finding edges from/to a specific node

---

### 5. `workflow_versions` (84 rows)
**Purpose:** Version control snapshots for workflows

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `workflowId` | String | FK to workflows |
| `version` | Int | Version number |
| `name` | String | Workflow name at this version |
| `nodesJson` | JSON | Snapshot of nodes |
| `edgesJson` | JSON | Snapshot of edges |
| `message` | String? | Commit message |
| `nodeCount` | Int | Quick count display |

**Key Points:**
- Auto-created on workflow save
- Allows "restore to version X" functionality

---

## Execution Tables

### 6. `workflow_executions` (213 rows)
**Purpose:** Track full workflow runs

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `workflowId` | String | FK to workflows |
| `userId` | String | FK to users |
| `triggerRunId` | String? | Trigger.dev run ID |
| `status` | Enum | PENDING, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED |
| `workflowSnapshot` | JSON | Frozen workflow state at execution time |
| `estimatedCost` | Int | Pre-calculated cost |
| `actualCost` | Int | Real cost after completion |
| `startedAt` | DateTime? | Execution start |
| `completedAt` | DateTime? | Execution end |
| `error` | String? | Error message if failed |

**Key Points:**
- Snapshot ensures reproducibility even if workflow changes
- Links to Trigger.dev for durable execution

---

### 7. `node_executions` (924 rows)
**Purpose:** Track individual node runs within a workflow execution

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `workflowExecutionId` | String | FK to workflow_executions |
| `nodeId` | String | Which node ran |
| `nodeType` | String | Node type |
| `status` | Enum | PENDING, QUEUED, RUNNING, WAITING, COMPLETED, FAILED, SKIPPED |
| `inputJson` | JSON? | Input data |
| `outputJson` | JSON? | Output data |
| `estimatedCost` | Int | Pre-calculated |
| `actualCost` | Int | Real cost |
| `startedAt` | DateTime? | Node start |
| `completedAt` | DateTime? | Node end |
| `error` | String? | Error if failed |
| `attemptNumber` | Int | Retry count |

**Key Points:**
- One row per node per workflow run
- Links to parent workflow_execution
- Tracks retries and timing

---

### 8. `quick_executions` (369 rows)
**Purpose:** Track single-node test runs (not full workflows)

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `userId` | String? | Optional user |
| `workflowId` | String? | Optional workflow context |
| `nodeId` | String? | Optional node reference |
| `nodeType` | String | What type of node |
| `status` | String | RUNNING, COMPLETED, FAILED |
| `inputJson` | JSON? | Test input |
| `outputJson` | JSON? | Test output |
| `provider` | String? | e.g., "openrouter", "fal" |
| `model` | String? | e.g., "openai/gpt-4o-mini" |
| `actualCost` | Int | Cost in credits |
| `durationMs` | Int? | How long it took |

**Key Points:**
- For "Test Node" functionality in editor
- No parent workflow execution needed
- Useful for experimentation

---

## Supporting Tables

### 9. `credit_transactions` (1,248 rows)
**Purpose:** Ledger of all credit changes (purchases, usage, refunds)

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `userId` | String | FK to users |
| `amount` | Int | Positive = credit, Negative = debit |
| `balanceAfter` | Int | Balance after transaction |
| `type` | Enum | PURCHASE, EXECUTION, REFUND, BONUS, ADJUSTMENT |
| `workflowExecutionId` | String? | Related execution |
| `nodeExecutionId` | String? | Related node |
| `description` | String? | Human-readable note |
| `metadata` | JSON? | Extra data (provider, model, etc.) |

**Key Points:**
- Full audit trail of all credit changes
- `balanceAfter` allows reconstructing history

---

### 10. `api_keys` (11 rows)
**Purpose:** API keys for external access (MCP, REST API)

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `userId` | String | FK to users |
| `name` | String | User-friendly name |
| `prefix` | String | First 8 chars (e.g., "sk_live_a1") |
| `hashedKey` | String | SHA-256 hash (unique) |
| `scopes` | String[] | Permissions (default: ["*"]) |
| `rateLimit` | Int | Requests per minute |
| `lastUsedAt` | DateTime? | Last use timestamp |
| `usageCount` | Int | Total uses |
| `expiresAt` | DateTime? | Optional expiration |
| `revokedAt` | DateTime? | Soft delete timestamp |

**Key Points:**
- Keys are hashed, never stored in plain text
- Prefix allows identification without exposing key
- Soft delete via `revokedAt`

---

### 11. `node_result_cache` (25 rows)
**Purpose:** Cache identical node executions to save costs

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `hash` | String | SHA-256 of (nodeType + inputs) |
| `nodeType` | String | What type of node |
| `output` | JSON | Cached output |
| `expiresAt` | DateTime | TTL for cache entry |

**Key Points:**
- Same input = same output = no need to re-run
- Hash-based lookup for O(1) cache hits
- TTL prevents stale data

---

### 12. `workflow_templates` (2 rows)
**Purpose:** Cache reusable workflow patterns

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `structureHash` | String | SHA-256 of workflow structure |
| `name` | String | Template name |
| `description` | String? | Auto-generated description |
| `nodesJson` | JSON | Template nodes |
| `edgesJson` | JSON | Template edges |
| `usageCount` | Int | Times this pattern was used |

**Key Points:**
- Speeds up MCP workflow building
- Popular patterns are cached

---

### 13. `provider_webhooks` (0 rows)
**Purpose:** Track incoming webhook callbacks from AI providers

| Column | Type | Description |
|--------|------|-------------|
| `id` | String | CUID primary key |
| `provider` | String | "fal", "elevenlabs", etc. |
| `providerJobId` | String | External job ID |
| `payloadJson` | JSON | Raw webhook data |
| `processed` | Boolean | Has it been handled? |
| `processedAt` | DateTime? | When processed |

**Key Points:**
- Currently unused (using polling instead)
- Ready for webhook-based async providers

---

## Key Relationships

```
users
  ├── workflows (1:many)
  │     ├── workflow_nodes (1:many) - NEW normalized storage
  │     ├── workflow_edges (1:many) - NEW normalized storage
  │     ├── workflow_versions (1:many)
  │     └── workflow_executions (1:many)
  │           └── node_executions (1:many)
  ├── api_keys (1:many)
  ├── credit_transactions (1:many)
  └── quick_executions (1:many)
```

---

## Database Optimization: Normalization

### The Problem (Before)
All nodes stored as one JSON blob:
```json
// workflows.nodesJson - ONE column with ALL nodes
[{"id":"node-1",...}, {"id":"node-2",...}, ... 1000 more ...]
```

**Issues:**
- Load 1 node = Load ALL nodes
- Update 1 node = Rewrite ALL nodes
- Can't query individual nodes
- Can't paginate

### The Solution (After)
Each node is a separate row:
```sql
-- workflow_nodes - ONE row per node
| id | workflowId | nodeId   | type    | positionX | positionY |
|----|------------|----------|---------|-----------|-----------|
| a1 | wf-123     | input-1  | input   | 0         | 100       |
| a2 | wf-123     | llm-2    | openrouter | 350    | 100       |
```

**Benefits:**
- Pagination: `SELECT * FROM workflow_nodes LIMIT 100`
- Partial updates: `UPDATE workflow_nodes SET positionX=500 WHERE nodeId='input-1'`
- Query by type: `SELECT * FROM workflow_nodes WHERE type='openrouter'`

---

## Interview Talking Points

1. **Why PostgreSQL + Neon?**
   - Serverless = scales to zero, low cost
   - Branching for dev/staging environments
   - Prisma ORM integration

2. **Why normalize JSON to tables?**
   - Scalability for 1000+ node workflows
   - Database can do filtering/pagination instead of app code
   - Partial updates instead of full rewrites

3. **Credit system design:**
   - Ledger pattern with `credit_transactions`
   - `balanceAfter` allows audit trail reconstruction
   - Micro-units (1M = $1) for precision without floats

4. **Execution model:**
   - `workflow_executions` = the run
   - `node_executions` = each step within the run
   - `quick_executions` = single-node tests (no workflow)
   - Trigger.dev for durable, retryable execution

5. **Caching strategy:**
   - `node_result_cache` = same input → cached output
   - `workflow_templates` = reusable workflow patterns
   - Hash-based lookup for O(1) performance

Good luck with your interview! 🚀
