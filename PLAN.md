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
