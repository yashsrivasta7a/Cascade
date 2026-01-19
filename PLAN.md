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

## 📡 Realtime Data Flow

The execution engine uses **fast polling** (500ms) for responsive UI updates. This approach was chosen after testing various alternatives.

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  workflow-executor.ts (Trigger.dev Worker)                      │
│                                                                 │
│  Orchestrates DAG execution:                                    │
│  - Builds dependency graph from edges                           │
│  - Starts nodes with no dependencies in parallel                │
│  - Polls for node completion, starts dependent nodes            │
│  - Updates database with node statuses                          │
│                                                                 │
│  Uses metadata.set() for realtime (currently not working        │
│  with React hooks, but DB updates are reliable)                 │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ Database writes
                              │ (node execution status)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Prisma)                                            │
│                                                                 │
│  WorkflowExecution: status, startedAt, completedAt              │
│  NodeExecution: nodeId, status, outputJson, error               │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ REST API
                              │ GET /api/workflow-executions/{id}
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  Frontend (useRealtimeWorkflow hook)                            │
│                                                                 │
│  Fast polling (500ms) for responsive updates:                   │
│                                                                 │
│    - Polls /api/workflow-executions/{id}                        │
│    - Compares node statuses with previous state                 │
│    - Triggers callbacks on status changes                       │
│    - Stops polling when workflow completes                      │
└────────────────────────────────────────────────────────────────┘
```

### Why Polling Instead of Realtime?

We tested multiple realtime approaches before settling on polling. Here's why each failed:

#### 1. Server-Sent Events (SSE) via Vercel

**Attempted:** Created `/api/workflow/stream` endpoint that subscribes to Trigger.dev runs and forwards events as SSE.

**Why it failed:**
- Vercel's serverless functions buffer responses before sending to client
- Even with `X-Accel-Buffering: no` and `Content-Encoding: none` headers, events get batched
- User sees all nodes as "queued", then suddenly all complete at once
- Works locally (Node.js streams properly) but fails in production
- Vercel's Edge Runtime doesn't help - still buffers SSE responses

```typescript
// This doesn't work on Vercel - events get buffered
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",  // Ignored by Vercel
  },
});
```

#### 2. Trigger.dev `useRealtimeRun` Hook

**Attempted:** Use `@trigger.dev/react-hooks` to subscribe directly from frontend.

**Why it failed:**
- The hook successfully connects to Trigger.dev's WebSocket
- Receives run-level status updates (`EXECUTING`, `COMPLETED`, etc.)
- **BUT `run.metadata` is always empty** - never receives `metadata.set()` updates
- This is a Trigger.dev SDK limitation - metadata updates don't propagate to React hooks
- Confirmed with logs: `metadata keys=0` even while workflow executor calls `metadata.set()`

```typescript
// Hook connects but metadata is empty
const { run } = useRealtimeRun(triggerRunId, { accessToken: publicToken });
console.log(run.metadata);  // Always {} - never receives node status updates
```

#### 3. Trigger.dev `useRealtimeTaskTrigger` Hook

**Attempted:** Trigger workflow directly from frontend using one-time trigger tokens.

**Why it failed:**
- Hook requires `accessToken` (trigger token) to be available immediately on mount
- Our flow: user clicks "Run" → fetch token from API → use in hook
- **But hook throws "Missing accessToken" error** when token is initially `null`
- No `enabled` option to defer hook activation (unlike `useRealtimeRun`)
- Can't conditionally call hooks in React (rules of hooks)

```typescript
// This throws error because triggerToken is null initially
const { submit } = useRealtimeTaskTrigger("executeWorkflow", {
  accessToken: triggerToken,  // Error: "Missing accessToken in TriggerAuthContext"
});
```

#### 4. WebSockets

**Why not attempted:**
- Vercel serverless functions have 10-second timeout (free) / 60-second (pro)
- WebSocket connections require persistent server process
- Would need separate WebSocket server (Pusher, Ably, etc.) adding complexity and cost
- Trigger.dev's realtime already uses WebSockets under the hood - if that doesn't work, custom WS won't help

### Summary

| Approach | Works Locally | Works on Vercel | Why |
|----------|---------------|-----------------|-----|
| SSE | ✅ | ❌ | Vercel buffers SSE responses |
| `useRealtimeRun` | ❌ | ❌ | Metadata updates don't propagate |
| `useRealtimeTaskTrigger` | ❌ | ❌ | Can't handle dynamic tokens |
| WebSocket | N/A | ❌ | Serverless timeout limits |
| **Polling (500ms)** | ✅ | ✅ | Database is always consistent |

### Current Solution

**Fast polling (500ms)** provides:
- ✅ Responsive updates (indistinguishable from realtime for humans)
- ✅ Reliable on Vercel
- ✅ Shows parallel execution correctly
- ✅ Node glow animations work
- ✅ Simple, debuggable code

### Polling Flow

```typescript
// useRealtimeWorkflow hook
useEffect(() => {
  const pollNodeStatuses = async () => {
    const response = await fetch(`/api/workflow-executions/${id}`);
    const { execution } = await response.json();
    
    for (const node of execution.nodeExecutions) {
      const previousStatus = processedNodeStatuses.get(node.nodeId);
      if (previousStatus !== node.status) {
        // Status changed - trigger callback
        if (node.status === "RUNNING") onNodeStarted(node.nodeId);
        if (node.status === "COMPLETED") onNodeCompleted(node.nodeId, output);
        if (node.status === "FAILED") onNodeFailed(node.nodeId, error);
      }
    }
    
    if (!workflowCompleted) setTimeout(pollNodeStatuses, 500);
  };
  
  pollNodeStatuses();
}, [workflowExecutionId]);

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

## 📋 Backlog / Future Ideas

- [ ] Node templates (save & reuse node groups)
- [ ] Workflow marketplace
- [ ] Team collaboration
- [ ] API key management UI
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
