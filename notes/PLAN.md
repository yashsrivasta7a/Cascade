# Flowsmith Development Plan

## Overview

**Flowsmith** is a visual AI workflow builder that lets users create, connect, and execute AI-powered pipelines with an intuitive node-based interface.

**Live URL:** https://flowsmiths.vercel.app

---

## ✅ Completed Features

### Core Infrastructure
- [x] Next.js 14 App Router setup
- [x] PostgreSQL database with Prisma ORM
- [x] Clerk authentication integration
- [x] Trigger.dev background job processing
- [x] tRPC API layer with type safety
- [x] Zustand state management with persistence
- [x] Dark/Light theme support

### Visual Workflow Editor
- [x] ReactFlow canvas with drag-and-drop
- [x] Node palette with categorized nodes
- [x] Edge connections with type validation
- [x] Auto-layout algorithm for DAG visualization
- [x] Copy/paste nodes (Ctrl+C, Ctrl+V)
- [x] Undo/redo support (Ctrl+Z, Ctrl+Shift+Z)
- [x] Multi-select and bulk operations
- [x] Keyboard shortcuts (R to run, Esc to stop)
- [x] Comment nodes for annotations
- [x] Node context menu (right-click)

### AI Node Types
- [x] **Seedream** - Image generation (fal.ai)
- [x] **Seedance** - Video generation (fal.ai)
- [x] **SeedVR** - VR content generation (fal.ai)
- [x] **OpenRouter LLM** - GPT-4, Claude, Llama, etc.
- [x] **ElevenLabs** - Text-to-speech synthesis
- [x] **Merge Videos** - Combine videos with transitions
- [x] **Extract Audio** - Extract audio from video
- [x] **Crop Image** - Crop and resize images

### Execution Engine
- [x] DAG-based parallel execution
- [x] SSE streaming for real-time progress
- [x] Node status tracking (queued → running → completed/failed)
- [x] Cascading failure propagation
- [x] Cancel workflow / cancel individual node
- [x] Credit deduction per execution
- [x] Output propagation to downstream nodes

### UI/UX
- [x] Modern glassmorphism design
- [x] Responsive sidebar navigation
- [x] Activity panel with execution history
- [x] Version history with restore
- [x] Credit balance display
- [x] Run modal with cost estimation
- [x] Error panel with retry options
- [x] Connected input previews (shows upstream output)

### API & Authentication
- [x] API key management system (Settings → API Keys)
- [x] Dual authentication (Clerk sessions + Bearer token API keys)
- [x] Secure key storage (SHA-256 hashed, never stored in plain text)
- [x] Key expiration options (30d, 90d, 1 year, or never)
- [x] Usage tracking (request count, last used timestamp)
- [x] Public REST API with OpenAPI documentation

### Recent Fixes
- [x] Dark mode dropdown styling
- [x] Video merge transitions in production (FFmpeg)
- [x] OpenRouter image URL parsing (string or object)
- [x] Type compatibility for LLM → settings fields
- [x] Light mode handle tooltips
- [x] Node context menu light mode
- [x] Cascading node failures
- [x] "Cancelled by user" false positive fix
- [x] Crop image preview accuracy
- [x] Global upload tracking (disable Run while uploading)

---

## 🧪 Test Coverage

**Total: 357+ tests passing**

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| Unit Tests | 17 | ~310 | ✅ |
| Integration Tests | 3 | ~46 | ✅ |
| E2E Tests | 4 | ~45 | ✅ |

### Unit Tests Breakdown

| Test Suite | Tests | What It Covers |
|------------|-------|----------------|
| type-compatibility | 43 | Node connection type rules |
| toast | 37 | Notification system |
| credits | 36 | Credit calculation & formatting |
| input | 31 | Input component rendering |
| flow-store-extended | 28 | Copy/paste, undo/redo, highlighting |
| card | 26 | Card UI component |
| button | 22 | Button UI component |
| version-export | 18 | Workflow export/import |
| use-workflow-stream | 18 | SSE streaming hook |
| auto-layout | 17 | DAG layout algorithm |
| use-execution-stream | 16 | Execution state polling |
| llm-type-parser | 9 | LLM output → typed values |
| node-schemas | 3 | Zod schema validation |
| Others | 12 | Badge, utils, flow-store |

### E2E Tests Breakdown (Playwright)

| Test File | Category | What It Covers |
|-----------|----------|----------------|
| **smoke.spec.ts** | Smoke | App boots, routes to auth/dashboard |
| **auth.spec.ts** | Authentication | Sign-in/sign-up pages, route protection |
| | | Unauthenticated redirect behavior |
| | | Navigation guards for protected routes |
| **dashboard.spec.ts** | Dashboard | Page load & navigation |
| | | API route health checks |
| | Responsive | Mobile/tablet/desktop viewport rendering |
| | Error Handling | 404 pages, malformed URLs |
| | Performance | Page load time < 10s |
| | SEO | Viewport meta, charset tags |
| **workflow.spec.ts** | Workflows | List page, editor routes, new workflow |
| | Pages | Executions, billing, settings, templates, ledger |
| | Deep Links | Workflow editor with ID, execution detail |
| | Assets | Favicon accessibility |
| | Navigation | Client-side navigation (no full reload) |
| | Errors | React error boundary detection |
| | Privacy | No blocking script errors |
| | Accessibility | Landmarks, headings, alt text, keyboard nav |
| | Console | No critical console errors on load |

### E2E Test Categories

| Category | Purpose |
|----------|---------|
| **Route Protection** | Ensures auth guards work (redirect to sign-in) |
| **Page Accessibility** | All routes return < 500 status code |
| **Responsive Design** | UI renders correctly on all viewports |
| **Error Handling** | Graceful handling of 404s, invalid IDs |
| **Performance** | Page loads within acceptable time limits |
| **SEO/Metadata** | Proper HTML meta tags for SEO |
| **Accessibility (a11y)** | WCAG basics: landmarks, alt text, keyboard |
| **Console Health** | No critical JS errors on page load |

---

## 🏗️ Architecture

### Config-Driven Node System

All node types are defined **declaratively** - no custom code per node.

```
lib/config/
├── index.ts           # Exports
├── node-config.ts     # Node definitions
├── provider-adapters.ts # API adapters
└── types.ts           # TypeScript types
```

### How It Works

```
┌─────────────────┐
│  NODE_CONFIG    │  ← Declarative definition
│  (node-config)  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Schema │ │   UI   │  ← Auto-generated
│ (Zod)  │ │ Fields │
└────────┘ └────────┘
    │         │
    ▼         ▼
┌─────────────────┐
│  GenericNode    │  ← Single component
│   Component     │     renders all nodes
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Provider Adapter│  ← API abstraction
│ (fal, openrouter)│
└─────────────────┘
```

### Adding a New Node

1. Define Zod schema
2. Add to `NODE_CONFIG` object
3. **Done** - no component code needed

#### Example: Adding "Stable Diffusion 3" Node

```typescript
// In lib/config/node-config.ts

export const NODE_CONFIG: NodeConfigRegistry = {
  // ... existing nodes ...

  stableDiffusion3: {
    type: "stableDiffusion3",
    version: "1.0.0",
    category: "image",
    label: "Stable Diffusion 3",
    description: "Generate images with SD3 model",
    color: "violet",  // Node header color
    
    // Provider configuration (API integration)
    providers: [
      {
        id: "fal",
        model: "fal-ai/stable-diffusion-3",
        inputMapping: {
          prompt: "prompt",
          negativePrompt: "negative_prompt",
          aspectRatio: "image_size",
          seed: "seed",
        },
        outputMapping: {
          "image.url": "images[0].url",
          "image.mimeType": "images[0].content_type",
          "image.width": "images[0].width",
          "image.height": "images[0].height",
        },
      },
    ],
    
    // Input validation schema (Zod)
    inputSchema: z.object({
      prompt: z.string().min(1).max(4096),
      negativePrompt: z.string().optional(),
      aspectRatio: z.enum(["1:1", "16:9", "9:16"]).default("1:1"),
      seed: z.number().int().optional(),
      steps: z.number().int().min(1).max(50).default(28),
    }),
    
    // Output schema
    outputSchema: ImageOutSchema,
    
    // Execution settings
    execution: {
      timeout: "5m",
      retryPerProvider: 2,
      maxRetries: 3,
    },
    
    // UI field definitions (auto-rendered)
    ui: {
      inputs: [
        { id: "prompt", type: "textarea", label: "Prompt", required: true, rows: 3 },
        { id: "negativePrompt", type: "textarea", label: "Negative Prompt", rows: 2, advanced: true },
        { id: "aspectRatio", type: "select", label: "Aspect Ratio", options: ["1:1", "16:9", "9:16"] },
        { id: "seed", type: "number", label: "Seed", placeholder: "Random", advanced: true },
        { id: "steps", type: "slider", label: "Steps", min: 1, max: 50, defaultValue: 28, advanced: true },
      ],
      outputs: [
        { id: "image", type: "image", label: "Generated Image" },
      ],
    },
    
    // Credit cost (1 credit = $0.000001)
    estimatedCost: 35_000,
    estimatedTime: "~8s",
    
    // Mock response for testing
    mockResponse: () => ({
      type: "image",
      image: {
        url: "https://picsum.photos/1024/1024",
        mimeType: "image/jpeg",
        width: 1024,
        height: 1024,
      },
    }),
  },
};
```

**That's it!** The `GenericNode` component auto-renders the UI fields, handles connections, and the execution engine knows how to call the provider API.

### Provider Support

| Provider | Nodes | Features |
|----------|-------|----------|
| fal.ai | Seedream, Seedance, SeedVR | Async webhook, sync mode |
| OpenRouter | LLM | Streaming, vision support |
| ElevenLabs | TTS | Multiple voices |
| Internal | Crop, Merge, Extract | FFmpeg processing |

---

## ⚡ Performance Optimizations

Two key optimizations for workflow execution at scale (100+ nodes):

### 1. Topological Sort Memoization

**File:** `lib/workflow/node-utils.ts`

**Problem:** `topoSort()` was recalculated on every workflow run, even when the graph hadn't changed.

**Solution:** Cache the sorted order using a hash of node IDs + edge connections.

```typescript
// Cache structure
let _topoSortCache: {
  hash: string;      // "nodeA,nodeB|nodeA->nodeB,nodeB->nodeC"
  sortedIds: string[];
} | null = null;

// On each call:
const hash = getGraphHash(nodes, edges);
if (_topoSortCache?.hash === hash) {
  return cached;  // O(1) - instant return
}
// else: calculate and cache
```

**Where It's Used:**

| File | Function | What It Does |
|------|----------|--------------|
| `lib/workflow/run-workflow.ts` | `runWorkflow()` | Get execution order for parallel DAG execution |
| `lib/workflow/run-workflow.ts` | `runWorkflowSubset()` | Get order for partial workflow runs |
| `lib/workflow/node-utils.ts` | `getUpstreamNodes()` | Sort upstream dependencies |

**Before vs After (100-node workflow, 5 runs):**

```
BEFORE (No Cache):
┌─────────────────────────────────────────────────────────────┐
│ Run 1: topoSort() → Loop through 100 nodes + 150 edges     │
│        Build inDegree map, adjacency list, BFS traversal   │
│        Operations: ~500                                     │
├─────────────────────────────────────────────────────────────┤
│ Run 2: topoSort() → SAME calculation again                 │
│        Operations: ~500                                     │
├─────────────────────────────────────────────────────────────┤
│ Run 3: topoSort() → SAME calculation again                 │
│        Operations: ~500                                     │
├─────────────────────────────────────────────────────────────┤
│ Run 4: topoSort() → SAME calculation again                 │
│        Operations: ~500                                     │
├─────────────────────────────────────────────────────────────┤
│ Run 5: topoSort() → SAME calculation again                 │
│        Operations: ~500                                     │
├─────────────────────────────────────────────────────────────┤
│ TOTAL: 5 × 500 = 2,500 operations                          │
└─────────────────────────────────────────────────────────────┘

AFTER (With Cache):
┌─────────────────────────────────────────────────────────────┐
│ Run 1: topoSort() → Cache MISS, calculate + store          │
│        Operations: ~500 + hash calculation                  │
├─────────────────────────────────────────────────────────────┤
│ Run 2: topoSort() → Cache HIT, return stored order         │
│        Operations: ~1 (just hash compare)                   │
├─────────────────────────────────────────────────────────────┤
│ Run 3: topoSort() → Cache HIT                              │
│        Operations: ~1                                       │
├─────────────────────────────────────────────────────────────┤
│ Run 4: topoSort() → Cache HIT                              │
│        Operations: ~1                                       │
├─────────────────────────────────────────────────────────────┤
│ Run 5: topoSort() → Cache HIT                              │
│        Operations: ~1                                       │
├─────────────────────────────────────────────────────────────┤
│ TOTAL: 500 + 4 = ~504 operations                           │
│ SAVED: 2,500 - 504 = ~1,996 operations (80% reduction)     │
└─────────────────────────────────────────────────────────────┘
```

**Cache Invalidation:**
- ✅ Invalidates when: Node added/removed, Edge added/removed
- ❌ Does NOT invalidate when: Node data changed, Node position moved

---

### 2. GraphIndex - O(1) Node & Edge Lookups

**File:** `lib/workflow/graph-index.ts`

**Problem:** Workflow execution uses many `nodes.find()` and `edges.filter()` calls - each is O(n).

```typescript
// Slow: O(n) per lookup
const node = nodes.find(n => n.id === "xyz");           // 1000 iterations
const incoming = edges.filter(e => e.target === nodeId); // 1500 iterations
```

**Solution:** Build indexed Maps once, then O(1) lookups:

```typescript
class GraphIndex {
  private nodeById: Map<string, Node>;           // "nodeId" → Node
  private edgesBySource: Map<string, Edge[]>;    // "nodeId" → outgoing edges
  private edgesByTarget: Map<string, Edge[]>;    // "nodeId" → incoming edges
  private dependencies: Map<string, Set<string>>; // "nodeId" → parent node IDs
  private dependents: Map<string, Set<string>>;   // "nodeId" → child node IDs
}

// Fast: O(1) lookups
const node = graph.getNode("xyz");
const incoming = graph.getIncomingEdges(nodeId);
const deps = graph.getDependencies(nodeId);
```

**How GraphIndex Pre-Organizes Data (Phone Book Analogy):**

```
Input edges array:
┌─────────────────────────────────────────────────────────────┐
│  edges = [                                                  │
│    { source: "LLM", target: "Image" },                      │
│    { source: "LLM", target: "TTS" },                        │
│    { source: "Image", target: "Video" },                    │
│  ]                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼ EK BAAR loop (constructor mein)
                          
┌─────────────────────────────────────────────────────────────┐
│  edgesBySource (OUTGOING) - "Kis node SE nikle":            │
│  {                                                          │
│    "LLM":   [→Image, →TTS],    // LLM se nikalne wale       │
│    "Image": [→Video],          // Image se nikalne wale     │
│  }                                                          │
├─────────────────────────────────────────────────────────────┤
│  edgesByTarget (INCOMING) - "Kis node MEIN aaye":           │
│  {                                                          │
│    "Image": [←LLM],            // Image mein aane wale      │
│    "TTS":   [←LLM],            // TTS mein aane wale        │
│    "Video": [←Image],          // Video mein aane wale      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Key Insight: Pre-Organized, Not Search-On-Demand**

```
❌ GALAT SAMAJH: "Jab dhundhe tab cache kare"
✅ SAHI SAMAJH:  "Constructor mein PEHLE SE hi sab organize kar diya"

const graph = new GraphIndex(nodes, edges);
// ↑ Yahaan hi sab Maps ban gaye - incoming, outgoing, nodeById
// Baad mein dhundna nahi padta - seedha Map se nikalo
```

**Comparison: With vs Without GraphIndex**

```
PEHLE (Bina GraphIndex) - HAR BAAR loop:
─────────────────────────────────────────
"LLM ke outgoing edges chahiye"
   ↓
edges.filter(e => e.source === "LLM")
   ↓
Loop: edge[0].source === "LLM"? ✓
      edge[1].source === "LLM"? ✓
      edge[2].source === "LLM"? ✗
      ... (1500 edges check karo)
   ↓
Found 2 edges. Return.

HAR BAAR yeh loop chalta hai = O(n)


AB (GraphIndex ke saath) - Direct lookup:
─────────────────────────────────────────
Constructor mein (EK BAAR):
   All edges loop → edgesBySource Map ready

Baad mein:
"LLM ke outgoing edges chahiye"
   ↓
edgesBySource.get("LLM")
   ↓
Direct return [→Image, →TTS]! No loop.

Seedha Map se nikala = O(1)
```

**Phone Book Analogy:**

```
❌ Bina Index: 
   Phone book mein har baar page 1 se naam dhundho
   1000 naam check karo "Sharma" dhundne ke liye

✅ GraphIndex:
   Phone book ko A-Z sections mein organize kar diya (EK BAAR)
   Ab "S" dhundna hai? Direct "S" section pe jaao
   1 step mein mil gaya
```

**Where It's Used:**

| File | Function | Before (Slow) | After (Fast) |
|------|----------|---------------|--------------|
| `lib/workflow/run-workflow.ts` | `runWorkflow()` | Manual Map + loop to build dependencies | `graph.dependencies` (pre-built) |

**Before vs After Code:**

```typescript
// ❌ BEFORE: runWorkflow() mein yeh sab manually hota tha
export async function runWorkflow(nodes, edges) {
  const allNodes = topoSort(nodes, edges);
  
  // Manually build dependency graph - EVERY RUN
  const nodeById = new Map(allNodes.map(n => [n.id, n]));  // O(n)
  const dependencies = new Map();  
  const dependents = new Map();
  
  for (const node of allNodes) {           // O(n) loop
    dependencies.set(node.id, new Set());
    dependents.set(node.id, new Set());
  }
  
  for (const edge of edges) {              // O(e) loop
    dependencies.get(edge.target).add(edge.source);
    dependents.get(edge.source).add(edge.target);
  }
  // Total: O(n + e) EVERY RUN
}

// ✅ AFTER: GraphIndex use karte hain (cached)
export async function runWorkflow(nodes, edges) {
  const allNodes = topoSort(nodes, edges);  // Cached
  
  // Use GraphIndex - cached if graph unchanged
  const graph = getGraphIndex(nodes, edges);  // O(1) if cached
  const dependencies = graph.dependencies;    // Already built
  const dependents = graph.dependents;        // Already built
  // Total: O(1) on repeat runs
}
```

**Before vs After (100-node workflow execution):**

```
BEFORE: What happens during ONE workflow run
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: Build nodeById Map                                          │
│         for (node of 100 nodes) → map.set()                        │
│         Operations: 100                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Step 2: Initialize dependencies/dependents Maps                     │
│         for (node of 100 nodes) → create empty Sets                │
│         Operations: 200                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Step 3: Populate from edges                                         │
│         for (edge of 150 edges) → add to Sets                      │
│         Operations: 300                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Step 4: During execution - find source nodes                        │
│         nodes.find() called ~50 times                              │
│         Each find() loops through 100 nodes                        │
│         Operations: 50 × 100 = 5,000                               │
├─────────────────────────────────────────────────────────────────────┤
│ Step 5: During execution - filter edges                             │
│         edges.filter() called ~50 times                            │
│         Each filter() loops through 150 edges                      │
│         Operations: 50 × 150 = 7,500                               │
├─────────────────────────────────────────────────────────────────────┤
│ TOTAL for ONE run: 100 + 200 + 300 + 5,000 + 7,500 = 13,100 ops    │
│ For 5 runs: 5 × 13,100 = 65,500 operations                         │
└─────────────────────────────────────────────────────────────────────┘

AFTER: What happens with GraphIndex
┌─────────────────────────────────────────────────────────────────────┐
│ Run 1: GraphIndex cache MISS                                        │
│        Build index: nodeById + edgesBySource + edgesByTarget       │
│        Build dependency graph                                       │
│        Operations: ~600 (one-time)                                  │
├─────────────────────────────────────────────────────────────────────┤
│ Run 1: During execution                                             │
│        graph.getNode() called 50 times → O(1) each = 50 ops        │
│        graph.getIncomingEdges() called 50 times → O(1) each = 50   │
│        graph.getDependencies() → already cached = 0 ops            │
│        Operations: ~100                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Run 1 TOTAL: 600 + 100 = 700 ops                                   │
├─────────────────────────────────────────────────────────────────────┤
│ Run 2-5: GraphIndex cache HIT                                       │
│        Hash compare: O(1)                                           │
│        Execution lookups: ~100 ops each                            │
│        Operations per run: ~100                                     │
├─────────────────────────────────────────────────────────────────────┤
│ TOTAL for 5 runs: 700 + (4 × 100) = 1,100 operations               │
│                                                                     │
│ SAVED: 65,500 - 1,100 = 64,400 operations (98% reduction!)         │
└─────────────────────────────────────────────────────────────────────┘
```

**Performance Numbers (1000 nodes, 1500 edges):**

| Operation | Before (Array) | After (GraphIndex) | Saved |
|-----------|----------------|-------------------|-------|
| Find 1 node | 1,000 ops | 1 op | 999 ops |
| Filter edges to node | 1,500 ops | 1 op | 1,499 ops |
| Build dependency graph | 2,500 ops/run | 2,500 ops once | 2,500 × (runs-1) |
| 50 find() calls | 50,000 ops | 50 ops | 49,950 ops |
| 50 filter() calls | 75,000 ops | 50 ops | 74,950 ops |
| **5 runs total** | **~637,500 ops** | **~12,750 ops** | **~624,750 ops** |

**Speed improvement: ~50x faster for 1000-node workflows with multiple runs**

---

### Summary

| Optimization | What It Caches | Invalidates When | Benefit |
|--------------|----------------|------------------|---------|
| **topoSort** | Execution order | Nodes/edges change | Skip recalculation on repeat runs |
| **GraphIndex** | Node/edge lookups + dependency graph | Nodes/edges change | O(1) vs O(n) lookups |

**Combined Effect Example (1000 nodes, 5 runs):**

```
┌────────────────────────────────────────────────────────────┐
│                    BEFORE OPTIMIZATIONS                    │
├────────────────────────────────────────────────────────────┤
│ topoSort: 5 × 2,500 = 12,500 ops                          │
│ Dependency build: 5 × 5,000 = 25,000 ops                  │
│ Node lookups: 5 × 50,000 = 250,000 ops                    │
│ Edge lookups: 5 × 75,000 = 375,000 ops                    │
│ ──────────────────────────────────────                    │
│ TOTAL: ~662,500 operations                                │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                    AFTER OPTIMIZATIONS                     │
├────────────────────────────────────────────────────────────┤
│ topoSort: 2,500 (first) + 4 × 1 = 2,504 ops              │
│ GraphIndex build: 7,500 (first) + 4 × 1 = 7,504 ops      │
│ Node lookups: 5 × 50 = 250 ops                            │
│ Edge lookups: 5 × 50 = 250 ops                            │
│ ──────────────────────────────────────                    │
│ TOTAL: ~10,508 operations                                 │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ SAVED: 662,500 - 10,508 = 651,992 operations              │
│ REDUCTION: 98.4%                                          │
│ SPEEDUP: ~63x faster                                       │
└────────────────────────────────────────────────────────────┘
```

---

### Files Changed

| File | Change |
|------|--------|
| `lib/workflow/node-utils.ts` | Added topoSort memoization with hash-based cache |
| `lib/workflow/graph-index.ts` | **NEW** - GraphIndex class with O(1) lookups |
| `lib/workflow/run-workflow.ts` | Updated to use GraphIndex instead of manual Maps |

---

### Future Optimizations (Not Implemented)

| Optimization | Effort | Impact | Description |
|--------------|--------|--------|-------------|
| React Flow virtualization | Low | High | `onlyRenderVisibleElements={true}` - only render visible nodes |
| GraphIndex in build-input.ts | Medium | High | Replace remaining `nodes.find()` calls |
| Web Workers | High | Medium | Offload heavy computation to background thread |
| Validation debounce | Low | Medium | Don't validate on every keystroke |

---

## 📡 Realtime Architecture

The execution engine uses **Trigger.dev's WebSocket-based Realtime API** for instant UI updates. The browser connects directly to Trigger.dev's servers via WebSocket, completely bypassing Vercel.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│  1. User clicks "Run"                                            │
│  2. POST /api/workflow/trigger → returns { runId, publicToken }  │
│  3. useRealtimeRun(runId, { accessToken: publicToken })          │
│     └── Opens WebSocket to Trigger.dev cloud                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket (wss://...)
                              │ Direct to Trigger.dev
                              │ (Bypasses Vercel entirely)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Trigger.dev Cloud                                               │
│                                                                  │
│  - Manages WebSocket connections from browsers                   │
│  - Broadcasts run updates when metadata.set() is called          │
│  - Sends: { run.id, run.status, run.metadata, ... }             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Internal communication
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  workflow-executor.ts (Trigger.dev Worker)                       │
│                                                                  │
│  DAG Execution:                                                  │
│  1. Build dependency graph from edges                            │
│  2. Start nodes with no dependencies (parallel)                  │
│  3. When node completes: metadata.set("node:{id}", { status })   │
│  4. Start dependent nodes, repeat until done                     │
│  5. Final: metadata.set("workflow", { status: "completed" })     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────┐    POST /api/workflow/trigger    ┌─────────────────┐
│   Browser   │ ─────────────────────────────────▶│  Next.js API    │
│             │◀───── { runId, publicToken } ─────│  (Vercel)       │
└─────────────┘                                   └─────────────────┘
      │                                                   │
      │ useRealtimeRun(runId, token)                      │ tasks.trigger()
      │ WebSocket connection                              │
      ▼                                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Trigger.dev Cloud                             │
│                                                                  │
│   Browser ◀══WebSocket══▶ Realtime API ◀────▶ Worker Execution  │
│                                                                  │
│   run.metadata updates propagate instantly via WebSocket         │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

#### 1. API Route (`/api/workflow/trigger`)

```typescript
// Trigger workflow and create public access token for WebSocket subscription
const handle = await executeWorkflow.trigger({ workflowExecutionId, nodes, edges });

const publicToken = await auth.createPublicToken({
  scopes: { read: { runs: [handle.id] } },
  expirationTime: "30m",
});

return { triggerRunId: handle.id, publicToken };
```

#### 2. React Hook (`useRealtimeWorkflowV2`)

```typescript
// Inner component subscribes to Trigger.dev WebSocket
function RealtimeSubscriber({ triggerRunId, publicToken, callbacks }) {
  const { run } = useRealtimeRun(triggerRunId, { accessToken: publicToken });

  useEffect(() => {
    if (!run?.metadata) return;
    
    // Process node status updates from metadata
    for (const [key, value] of Object.entries(run.metadata)) {
      if (key.startsWith("node:")) {
        const nodeId = key.replace("node:", "");
        const { status, output, error } = value;
        
        if (status === "started") callbacks.onNodeStarted(nodeId);
        if (status === "completed") callbacks.onNodeCompleted(nodeId, output);
        if (status === "failed") callbacks.onNodeFailed(nodeId, error);
      }
    }
  }, [run]);
  
  return null; // Invisible component, just subscribes
}
```

#### 3. Workflow Executor (`workflow-executor.ts`)

```typescript
// Called when starting a node
await metadata.set(`node:${nodeId}`, {
  status: "started",
  nodeType,
  timestamp: Date.now(),
});

// Called when node completes
await metadata.set(`node:${nodeId}`, {
  status: "completed",
  nodeType,
  output: taskOutput,
  timestamp: Date.now(),
});

// Called when workflow finishes
await metadata.set("workflow", {
  status: "completed",
  successCount,
  failCount,
});
```

### Key Files

| File | Purpose |
|------|---------|
| `hooks/use-realtime-workflow-v2.tsx` | React hook with `useRealtimeRun` subscription |
| `app/api/workflow/trigger/route.ts` | Creates run + public token for WebSocket auth |
| `app/trigger/workflow-executor.ts` | Calls `metadata.set()` during execution |

### Why This Works

| Aspect | Solution |
|--------|----------|
| **No Vercel buffering** | WebSocket connects directly to Trigger.dev, not through Vercel |
| **Instant updates** | `metadata.set()` broadcasts immediately via WebSocket |
| **Secure** | Public token is scoped to specific run ID, expires in 30min |
| **Simple** | Single `useRealtimeRun` hook handles all subscription logic |

---

## 📁 Project Structure

```
flowsmith/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Dashboard pages
│   ├── api/                # API routes
│   └── trigger/            # Trigger.dev tasks
├── components/
│   ├── flow/               # ReactFlow components
│   ├── layout/             # Sidebar, header
│   └── ui/                 # Reusable UI components
├── lib/
│   ├── config/             # Config-driven node system
│   ├── workflow/           # Execution logic
│   └── credits.ts          # Credit calculations
├── store/                  # Zustand stores
├── tests/
│   ├── unit/               # Vitest unit tests
│   ├── integration/        # API tests
│   └── e2e/                # Playwright E2E tests
├── docs/                   # Mintlify documentation
└── prisma/                 # Database schema
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, TypeScript |
| State | Zustand with persistence |
| Styling | Tailwind CSS, Framer Motion |
| Canvas | ReactFlow |
| Backend | tRPC, Prisma, PostgreSQL |
| Auth | Clerk |
| Jobs | Trigger.dev |
| AI | fal.ai, OpenRouter, ElevenLabs |
| Media | Transloadit (CDN), FFmpeg |
| Testing | Vitest, Playwright |
| Docs | Mintlify |

---

## 📡 API Endpoints

### Documented (Public API)

These endpoints are documented in Mintlify and available for external integrations.

| Category | Endpoint | Method | Description | Source |
|----------|----------|--------|-------------|--------|
| **Workflows** | `/api/v1/workflows` | GET | List all workflows | tRPC (auto) |
| | `/api/v1/workflows/{id}` | GET | Get workflow by ID | tRPC (auto) |
| | `/api/v1/workflows` | POST | Create workflow | tRPC (auto) |
| | `/api/v1/workflows/{id}` | PATCH | Update workflow | tRPC (auto) |
| | `/api/v1/workflows/{id}` | DELETE | Delete workflow | tRPC (auto) |
| | `/api/v1/workflows/{id}/duplicate` | POST | Duplicate workflow | tRPC (auto) |
| | `/api/v1/workflows/{id}/execute` | POST | Execute workflow | tRPC (auto) |
| **Executions** | `/api/v1/executions` | GET | List executions | tRPC (auto) |
| | `/api/v1/executions/{id}` | GET | Get execution details | tRPC (auto) |
| | `/api/v1/executions/{id}/cancel` | POST | Cancel execution | tRPC (auto) |
| | `/api/v1/executions/{id}/stream` | GET | Stream updates (SSE) | tRPC (auto) |
| **Credits** | `/api/v1/credits/balance` | GET | Get credit balance | tRPC (auto) |
| | `/api/v1/credits/stats` | GET | Get usage statistics | tRPC (auto) |
| **Dashboard** | `/api/v1/dashboard/stats` | GET | Dashboard statistics | tRPC (auto) |
| **Nodes** | `/api/nodes/execute` | POST | Execute any node async | REST (manual) |
| | `/api/nodes/status` | GET | Check node status | REST (manual) |
| | `/api/nodes/llm/realtime` | POST | LLM streaming (SSE) | REST (manual) |
| **Media** | `/api/media/upload` | POST | Upload to CDN | REST (manual) |

**Total: 18 public endpoints**

### Not Documented (Internal Only)

These endpoints exist but are intentionally not documented - they are for internal use only.

| Endpoint | Method | Reason Not Documented |
|----------|--------|----------------------|
| `/api/nodes/execute-sync` | POST | Internal - limited to utility nodes only |
| `/api/nodes/llm/stream` | POST | Deprecated - replaced by `/llm/realtime` |
| `/api/nodes/image/generate` | POST | Redundant - use `/nodes/execute` instead |
| `/api/nodes/deduct-credits` | POST | Security - internal accounting only |
| `/api/media/upload-direct` | POST | Internal - duplicate of `/upload` |
| `/api/webhooks/fal` | POST | Infrastructure - provider callback |
| `/api/webhooks/clerk` | POST | Infrastructure - auth callback |
| `/api/debug/execution/{id}` | GET | Development - debugging only |
| `/api/test/*` | * | Development - test endpoints |
| `/api/trigger-runs` | POST | Infrastructure - Trigger.dev internal |
| `/api/trigger-test` | POST | Development - testing |
| `/api/openapi` | GET | Reference - serves OpenAPI spec |

### Documentation Generation

```
tRPC Routers ──► trpc-to-openapi ──► /api/openapi ──► Mintlify (auto)
REST Routes  ──► Manual MDX files ──────────────────► Mintlify (manual)
```

- **Auto-generated**: tRPC routes use `.meta({ openapi: {...} })` for automatic OpenAPI spec generation
- **Manual**: REST routes (streaming, webhooks) documented with MDX files in `docs/api-reference/`

---

## 🔑 API Key System

Flowsmith supports programmatic API access via API keys, allowing external applications to integrate with workflows, executions, and credits.

### Overview

| Feature | Description |
|---------|-------------|
| **Dual Authentication** | API routes accept both Clerk sessions (browser) and Bearer token API keys (programmatic) |
| **Secure Storage** | Keys are hashed with SHA-256 before storage - plain text keys are never stored |
| **One-Time Display** | Full API key is shown only once at creation - users must copy immediately |
| **Expiration Options** | Keys can expire after 30 days, 90 days, 1 year, or never |
| **Usage Tracking** | Request count and last-used timestamp tracked per key |
| **Revocation** | Keys can be revoked instantly from the Settings UI |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  User Flow                                                       │
│                                                                  │
│  1. Go to Settings → API Keys                                    │
│  2. Click "Create Key" → Enter name + expiration                 │
│  3. Copy the key immediately (sk_live_xxxxxxxx...)               │
│  4. Key is hashed (SHA-256) and stored in database              │
│  5. Use key in Authorization header for API requests             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  API Request Flow                                                │
│                                                                  │
│  Request:                                                        │
│  GET /api/v1/workflows                                           │
│  Authorization: Bearer sk_live_abc123...                         │
│                                                                  │
│  Server:                                                         │
│  1. Extract Bearer token from header                             │
│  2. Hash the token with SHA-256                                  │
│  3. Look up hashed key in database                               │
│  4. Verify key is not expired or revoked                         │
│  5. Update lastUsedAt and usageCount                             │
│  6. Return user context for the request                          │
└─────────────────────────────────────────────────────────────────┘
```

### Key Format

```
sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
└─────┘ └────────────────────────────────┘
 prefix       32 random hex characters
```

- **Prefix**: `sk_live_` - indicates it's a Flowsmith API key
- **Random part**: 32 hex characters (16 bytes of entropy)
- **Display in UI**: Only prefix shown after creation (e.g., `sk_live_a1b2••••••••`)

### Database Schema

```prisma
model ApiKey {
  id          String    @id @default(cuid())
  userId      String
  
  name        String    // User-friendly name
  prefix      String    // First 12 chars for display
  hashedKey   String    @unique // SHA-256 hash
  
  scopes      String[]  @default(["*"]) // Future: granular permissions
  rateLimit   Int       @default(100)   // Requests per minute
  
  lastUsedAt  DateTime?
  usageCount  Int       @default(0)
  
  expiresAt   DateTime? // Optional expiration
  revokedAt   DateTime? // Soft delete
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(...)
}
```

### API Endpoints (Internal)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/api-keys` | GET | List all active API keys | Clerk session |
| `/api/api-keys` | POST | Create new API key | Clerk session |
| `/api/api-keys/{id}` | DELETE | Revoke an API key | Clerk session |

**Note**: API key management requires Clerk authentication (browser session). You cannot create/revoke API keys using an API key.

### Authentication Priority

When a request comes in, the authentication system checks in this order:

```
1. Clerk Session (cookies)
   └── If valid → Use Clerk user context
   
2. Bearer Token (Authorization header)
   └── If valid API key → Use API key's user context
   
3. Neither
   └── Return 401 Unauthorized
```

### Security Considerations

| Aspect | Implementation |
|--------|----------------|
| **Storage** | SHA-256 hash only - keys cannot be recovered |
| **Transport** | HTTPS required - keys never sent in plain text |
| **Exposure** | Full key shown once - UI only shows prefix after creation |
| **Revocation** | Instant - revoked keys rejected immediately |
| **Expiration** | Checked on every request |
| **Rotation** | Create new key, update clients, revoke old key |

### Usage Example

```bash
# Create workflow via API
curl -X POST "https://flowsmiths.vercel.app/api/v1/workflows" \
  -H "Authorization: Bearer sk_live_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workflow", "nodesJson": [], "edgesJson": []}'

# Get credit balance
curl "https://flowsmiths.vercel.app/api/v1/credits/balance" \
  -H "Authorization: Bearer sk_live_abc123def456..."

# Execute a workflow
curl -X POST "https://flowsmiths.vercel.app/api/v1/workflows/{id}/execute" \
  -H "Authorization: Bearer sk_live_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{"inputs": {}}'
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/api-keys.ts` | Key generation, hashing, validation utilities |
| `lib/user.ts` | `authenticateUser()` - dual auth (Clerk + API key) |
| `lib/trpc/server.ts` | tRPC context with API key support |
| `app/api/api-keys/route.ts` | REST endpoints for key management |
| `app/(dashboard)/settings/page.tsx` | Settings UI with API Keys tab |
| `prisma/schema.prisma` | ApiKey model definition |

---

## 📋 Backlog / Future Ideas

- [ ] Node templates (save & reuse node groups)
- [ ] Workflow marketplace
- [ ] Team collaboration
- [ ] Webhook triggers (run workflow via API)
- [ ] Scheduled workflows (cron)
- [ ] More AI providers (Replicate, Stability AI)
- [ ] Custom node builder (no-code)
- [ ] Mobile responsive editor
- [ ] Workflow analytics dashboard

---

## 🚀 Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run trigger:dev      # Start Trigger.dev worker

# Testing
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:e2e         # Playwright E2E tests

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio

# Production
npm run build            # Build for production
npm run start            # Start production server
```

---

*Last updated: January 2026*
