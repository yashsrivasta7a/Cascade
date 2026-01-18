# Flowsmith

A visual AI workflow builder that lets you create, connect, and execute AI-powered pipelines with a node-based interface.

---

## Features

- **Visual Workflow Editor** – Drag-and-drop node-based interface powered by ReactFlow
- **AI Node Types** – Image generation, video generation, audio synthesis, LLM processing, and more
- **Real-time Execution** – SSE streaming for live workflow progress updates
- **Background Processing** – Long-running tasks handled by Trigger.dev workers
- **Media Processing** – Video/audio manipulation with cloud-based FFmpeg
- **Credit System** – Track AI usage with a built-in credit ledger
- **Version History** – Restore previous workflow versions
- **Dark/Light Mode** – Full theme support

---

## Setup Instructions

### Prerequisites

- **Node.js** 18+ 
- **PostgreSQL** database (or use Neon.tech)
- **Clerk** account for authentication
- **Trigger.dev** account for background jobs

### 1. Clone and Install

```bash
git clone https://github.com/your-repo/flowsmith.git
cd flowsmith
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════════════════════
DATABASE_URL="postgresql://user:password@host:5432/flowsmith?sslmode=require"

# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION (Clerk)
# ═══════════════════════════════════════════════════════════════════════════════
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..."  # For user sync webhooks

# ═══════════════════════════════════════════════════════════════════════════════
# TRIGGER.DEV (Background Jobs)
# ═══════════════════════════════════════════════════════════════════════════════
TRIGGER_SECRET_KEY="tr_dev_..."
TRIGGER_PROJECT_REF="proj_..."

# ═══════════════════════════════════════════════════════════════════════════════
# AI PROVIDERS
# ═══════════════════════════════════════════════════════════════════════════════
FAL_KEY="..."                    # For Seedream, Seedance, Seedvr (fal.ai)
OPENROUTER_API_KEY="..."         # For LLM nodes (OpenRouter)
ELEVENLABS_API_KEY="..."         # For text-to-speech (ElevenLabs)

# ═══════════════════════════════════════════════════════════════════════════════
# MEDIA PROCESSING (Transloadit)
# ═══════════════════════════════════════════════════════════════════════════════
TRANSLOADIT_AUTH_KEY="..."       # For cloud video/audio processing
TRANSLOADIT_AUTH_SECRET="..."

# ═══════════════════════════════════════════════════════════════════════════════
# APP CONFIG
# ═══════════════════════════════════════════════════════════════════════════════
NEXT_PUBLIC_APP_URL="http://localhost:3000"  # Your deployment URL
WEBHOOK_BASE_URL="http://localhost:3000"     # Webhook callback URL
```

### 3. Database Setup

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# (Optional) Open Prisma Studio
npm run db:studio
```

### 4. Start Development

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Trigger.dev worker (for background jobs)
npm run trigger:dev
```

Open [http://localhost:3000](http://localhost:3000) to access Flowsmith.

### 5. Production Build

```bash
npm run build
npm run start
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLOWSMITH ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Next.js App    │────▶│   Vercel Edge    │────▶│    PostgreSQL    │
│   (Frontend)     │     │   (API Routes)   │     │    (Neon.tech)   │
└────────┬─────────┘     └────────┬─────────┘     └──────────────────┘
         │                        │
         │ SSE Streaming          │ Task Triggers
         │                        ▼
         │               ┌──────────────────┐
         │               │   Trigger.dev    │
         │               │   (Workers)      │
         │               └────────┬─────────┘
         │                        │
         │                        ▼
         │               ┌──────────────────┐
         │               │   AI Providers   │
         │               │ • fal.ai         │
         │               │ • OpenRouter     │
         │               │ • ElevenLabs     │
         │               └──────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│   Transloadit    │     │   Clerk Auth     │
│   (Media CDN)    │     │   (Identity)     │
└──────────────────┘     └──────────────────┘
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Flow Canvas** | `components/flow/flow-canvas.tsx` | Main workflow editor with ReactFlow |
| **Node Types** | `components/flow/generic-node.tsx` | Unified node component for all AI types |
| **Node Definitions** | `types/nodes.ts` | Schema definitions for all node types |
| **Workflow Executor** | `app/trigger/workflow-executor.ts` | DAG-based parallel execution |
| **Node Executor** | `app/trigger/node-executor.ts` | Individual node processing |
| **State Management** | `store/flow-store.ts` | Zustand store for workflow state |
| **API Routes** | `app/api/` | REST/tRPC endpoints |

### Data Flow

1. **User builds workflow** → ReactFlow nodes/edges stored in Zustand
2. **User clicks Run** → API creates execution record in PostgreSQL
3. **Trigger.dev picks up** → Workflow executor analyzes DAG dependencies
4. **Parallel execution** → Independent nodes run simultaneously
5. **SSE streaming** → Real-time updates pushed to frontend
6. **Results cached** → Outputs stored for downstream nodes

---

## Design Decisions & Trade-offs

### 1. Trigger.dev for Background Jobs

**Decision**: Use Trigger.dev instead of serverless functions for AI execution.

**Why**:
- ✅ No 60-second timeout limits (Vercel serverless)
- ✅ Automatic retries with exponential backoff
- ✅ Built-in run tracking and debugging
- ✅ Parallel batch execution support

**Trade-off**: Additional service dependency, but essential for AI workloads that can take 2-5 minutes.

### 2. Dynamic FFmpeg Imports

**Decision**: Import FFmpeg only inside Trigger.dev `run()` functions.

**Why**:
- ✅ Prevents 50MB+ binary from being bundled into Vercel functions
- ✅ FFmpeg only loads on Trigger.dev workers where it's needed
- ✅ Keeps API routes fast and under size limits

**Trade-off**: Slightly more complex import patterns.

### 3. Transloadit for Large Media

**Decision**: Direct client uploads to Transloadit for files > 3MB.

**Why**:
- ✅ Bypasses Vercel's 4.5MB body limit
- ✅ Cloud-based video/audio processing (no local FFmpeg needed)
- ✅ Automatic CDN delivery with HTTP URLs

**Trade-off**: External dependency cost, but necessary for production media handling.

### 4. Zustand + localStorage for State

**Decision**: Use Zustand with persistence instead of server-side state.

**Why**:
- ✅ Instant UI updates during editing
- ✅ Offline capability (draft workflows saved locally)
- ✅ No database writes during active editing

**Trade-off**: State sync complexity when saving to server.

### 5. Generic Node Architecture

**Decision**: Single `GenericNode` component handles all node types via configuration.

**Why**:
- ✅ Consistent UI/UX across all nodes
- ✅ Easy to add new node types (just add to `NODE_DEFINITIONS`)
- ✅ Centralized field rendering logic

**Trade-off**: Complex field renderer system, but pays off at scale.

### 6. SSE over WebSockets

**Decision**: Server-Sent Events for real-time workflow updates.

**Why**:
- ✅ Works with Vercel serverless (no persistent connections needed)
- ✅ Simpler than WebSocket infrastructure
- ✅ Automatic reconnection handling

**Trade-off**: One-way communication only (sufficient for our use case).

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected nodes |
| `Ctrl/Cmd + V` | Paste nodes |
| `Ctrl/Cmd + D` | Duplicate selected nodes |
| `Delete / Backspace` | Delete selected nodes |
| `Ctrl/Cmd + A` | Select all nodes |
| `Escape` | Deselect all / Cancel operation |
| `Ctrl/Cmd + S` | Manual save (even with auto-save) |
| `Ctrl/Cmd + E` | Export workflow |
| `Space + Drag` | Pan canvas |
| `Ctrl/Cmd + +/-` | Zoom in/out |
| `Ctrl/Cmd + 0` | Zoom to fit |

---

## API Documentation

API documentation is available via Mintlify at your configured docs URL. The API provides endpoints for:

- **Workflows** – Create, read, update, delete workflows
- **Executions** – Trigger and monitor workflow runs
- **Nodes** – Execute individual nodes
- **Credits** – Check balance and usage history

---

## License

Private project - All rights reserved.
