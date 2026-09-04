# Cascade Folder Structure

> Complete guide to the codebase organization

## Root Level Overview

```
cascade/
├── app/              # Next.js App Router (pages, API routes)
├── components/       # React UI components
├── lib/              # Core business logic & utilities
├── hooks/            # Custom React hooks
├── store/            # Zustand state management
├── types/            # TypeScript type definitions
├── mcp/              # MCP Server (AI assistant integration)
├── prisma/           # Database schema
├── docs/             # Mintlify API documentation
├── public/           # Static assets
├── notes/            # Documentation & planning
└── .cursor/          # Cursor IDE rules
```

---

## 📁 `app/` - Next.js App Router

The main application using Next.js 14+ App Router.

```
app/
├── (dashboard)/          # Dashboard route group (shared layout)
│   ├── layout.tsx        # Dashboard shell with sidebar
│   ├── dashboard/        # /dashboard - Home stats
│   ├── workflows/        # /workflows - List & editor
│   │   └── [id]/         # /workflows/[id] - Single workflow editor
│   ├── executions/       # /executions - Run history
│   ├── templates/        # /templates - Pre-built workflows
│   ├── billing/          # /billing - Credits & payments
│   ├── ledger/           # /ledger - Transaction history
│   └── settings/         # /settings - User preferences
│
├── api/                  # API Routes
│   ├── admin/            # Admin endpoints (migration)
│   ├── api-keys/         # API key CRUD
│   ├── auth/             # Auth endpoints (MCP code flow)
│   ├── dashboard/        # Dashboard stats
│   ├── executions/       # Execution management
│   ├── media/            # File upload/proxy
│   ├── nodes/            # Node execution endpoints
│   ├── openapi/          # OpenAPI spec generation
│   ├── trpc/             # tRPC endpoint
│   ├── v1/               # REST API v1
│   ├── webhooks/         # Clerk & provider webhooks
│   ├── workflow/         # Workflow utilities
│   ├── workflow-executions/  # Execution CRUD
│   ├── workflow-templates/   # Template caching
│   └── workflows/        # Workflow CRUD
│       └── [id]/
│           ├── execute/  # Trigger execution
│           ├── nodes/    # Paginated node APIs (NEW)
│           └── realtime-token/  # Trigger.dev realtime
│
├── trigger/              # Trigger.dev tasks
│   ├── index.ts          # Task exports
│   ├── workflow-executor.ts  # Main workflow execution logic
│   ├── node-executor.ts  # Individual node execution
│   ├── streams.ts        # Streaming utilities
│   └── helpers/          # LLM parsing, handle mapping
│
├── sign-in/              # Clerk sign-in page
├── sign-up/              # Clerk sign-up page
├── auth/mcp/             # MCP OAuth callback
├── docs/                 # Embedded docs page
│
├── layout.tsx            # Root layout (providers, fonts)
├── page.tsx              # Landing page (redirects)
├── providers.tsx         # Client providers (tRPC, React Query)
├── globals.css           # Global styles (Tailwind)
└── favicon.ico           # App icon
```

### Key Files:
- **`trigger/workflow-executor.ts`** - The heart of execution logic (1100+ lines)
- **`api/workflows/[id]/nodes/`** - New paginated node APIs for scalability

---

## 📁 `components/` - React Components

Reusable UI components organized by feature.

```
components/
├── flow/                 # Workflow editor components
│   ├── flow-canvas.tsx   # Main React Flow canvas
│   ├── base-node.tsx     # Base node component
│   ├── generic-node.tsx  # Configurable node wrapper
│   ├── nodes/            # Specific node types
│   │   ├── input-node.tsx
│   │   ├── output-node.tsx
│   │   ├── image-input-node.tsx
│   │   ├── video-input-node.tsx
│   │   └── audio-input-node.tsx
│   ├── field-renderers/  # Form field components
│   │   ├── text-field.tsx
│   │   ├── number-field.tsx
│   │   ├── select-field.tsx
│   │   ├── file-field.tsx
│   │   └── toggle-field.tsx
│   ├── flow-canvas/      # Canvas utilities
│   │   ├── custom-edge.tsx
│   │   ├── connection-line.tsx
│   │   └── run-button.tsx
│   ├── activity-panel/   # Execution activity display
│   ├── node-palette.tsx  # Draggable node list
│   ├── node-inspector.tsx # Node property editor
│   ├── execution-panel.tsx # Run results display
│   ├── credits-panel.tsx # Credit balance widget
│   └── workflow-sidebar.tsx # Left sidebar
│
├── layout/               # App shell components
│   ├── header.tsx        # Top navigation
│   ├── sidebar.tsx       # Dashboard sidebar
│   └── user-menu.tsx     # User dropdown
│
├── ui/                   # Base UI primitives
│   ├── button.tsx        # Button variants
│   ├── card.tsx          # Card container
│   ├── input.tsx         # Form input
│   ├── badge.tsx         # Status badges
│   ├── theme-toggle.tsx  # Dark/light mode
│   └── media-loader.tsx  # Image/video loader
│
└── auth/                 # Auth-related components
    └── auth-flow-background.tsx
```

### Key Files:
- **`flow/flow-canvas.tsx`** - Main workflow editor canvas
- **`flow/generic-node.tsx`** - Renders any node type dynamically
- **`flow/node-palette.tsx`** - Drag-and-drop node selector

---

## 📁 `lib/` - Core Business Logic

The brain of the application - all business logic, utilities, and integrations.

```
lib/
├── db.ts                 # Prisma client singleton
├── user.ts               # User utilities (ensureCurrentUser)
├── credits.ts            # Credit system (deduct, refund)
├── api-keys.ts           # API key validation
├── logger.ts             # Logging utility
├── format.ts             # Number/date formatting
├── utils.ts              # General utilities (cn, etc.)
├── toast.ts              # Toast notifications
│
├── api/                  # API utilities
│   ├── with-auth.ts      # Auth middleware wrapper
│   ├── with-workflow.ts  # Workflow access wrapper
│   └── responses.ts      # Standardized responses
│
├── config/               # Node configuration system
│   ├── node-config.ts    # Central node registry
│   ├── schemas.ts        # Zod schemas for nodes
│   ├── types.ts          # Node type definitions
│   ├── provider-adapters.ts  # Provider mappings
│   └── nodes/            # Node definitions by category
│       ├── llm-nodes.ts      # OpenRouter, etc.
│       ├── image-nodes.ts    # Seedream, Seedvr, etc.
│       ├── video-nodes.ts    # Seedance, lipsync, etc.
│       ├── audio-nodes.ts    # ElevenLabs, etc.
│       ├── io-nodes.ts       # Input/Output nodes
│       └── utility-nodes.ts  # Merge, extract, etc.
│
├── providers/            # AI provider integrations
│   ├── fal.ts            # Fal.ai (images, video)
│   ├── openrouter.ts     # OpenRouter (LLMs)
│   ├── transloadit.ts    # Transloadit (media processing)
│   └── fallback.ts       # Fallback handling
│
├── engine/               # Execution engine
│   ├── generic-executor.ts   # Main executor
│   ├── node-registry.ts      # Node type registry
│   └── nodes-legacy/         # Legacy node executors
│       ├── seedream.ts       # Image generation
│       ├── seedance.ts       # Video generation
│       ├── openrouter.ts     # LLM execution
│       ├── elevenlabs.ts     # Text-to-speech
│       └── ... more
│
├── workflow/             # Workflow utilities
│   ├── auto-layout.ts    # Auto-position nodes
│   ├── validation.ts     # Workflow validation
│   ├── node-schemas.ts   # Node I/O schemas
│   ├── input-builder.ts  # Build execution inputs
│   ├── llm-type-parser.ts # Parse LLM responses
│   ├── graph-index.ts    # Graph traversal
│   └── run-workflow.ts   # Execution orchestration
│
├── cache/                # Caching utilities
│   └── node-cache.ts     # Node result caching
│
├── services/             # Service layer (NEW)
│   └── workflow-nodes.ts # Normalized node operations
│
└── trpc/                 # tRPC setup
    ├── server.ts         # tRPC server config
    ├── client.ts         # tRPC client
    ├── provider.tsx      # React provider
    └── routers/          # tRPC routers
        ├── workflow.ts   # Workflow operations
        ├── execution.ts  # Execution operations
        ├── credits.ts    # Credit operations
        ├── version.ts    # Version control
        └── dashboard.ts  # Dashboard stats
```

### Key Files:
- **`config/node-config.ts`** - Central node type registry
- **`providers/fal.ts`** - Fal.ai integration
- **`workflow/auto-layout.ts`** - Node positioning algorithm
- **`services/workflow-nodes.ts`** - NEW normalized database operations

---

## 📁 `hooks/` - Custom React Hooks

```
hooks/
├── use-workflow.ts               # Workflow CRUD operations
├── use-execution-stream.ts       # Stream execution updates
├── use-workflow-stream.ts        # Workflow realtime updates
├── use-realtime-workflow.ts      # Trigger.dev realtime
├── use-realtime-workflow-v2.tsx  # V2 realtime (improved)
├── use-workflow-realtime-subscription.tsx
├── use-file-upload.ts            # File upload handling
├── use-audio-player.ts           # Audio playback
└── use-dark-mode.ts              # Theme toggle
```

### Key Files:
- **`use-execution-stream.ts`** - SSE stream for live execution updates
- **`use-realtime-workflow-v2.tsx`** - Trigger.dev realtime integration

---

## 📁 `store/` - Zustand State Management

```
store/
├── flow-store.ts         # Main workflow editor state
├── helpers/              # Store utilities
│   ├── setting-clamp.ts  # Value clamping
│   └── types.ts          # Store types
└── index.ts              # Exports
```

### Key File:
- **`flow-store.ts`** - All editor state (nodes, edges, selection, etc.)

---

## 📁 `mcp/` - MCP Server

Model Context Protocol server for AI assistant integration.

```
mcp/cascade/
├── package.json          # Separate npm package
├── README.md             # MCP documentation
├── tsconfig.json         # TypeScript config
└── src/
    ├── index.ts          # Entry point
    ├── server.ts         # MCP server setup
    │
    ├── tools/            # MCP Tools
    │   ├── auth.ts       # Authentication tools
    │   ├── workflows.ts  # Workflow CRUD
    │   ├── executions.ts # Execution management
    │   ├── builder.ts    # Workflow builder
    │   ├── nodes.ts      # Node operations
    │   ├── presets.ts    # Pre-built workflows
    │   ├── credits.ts    # Credit checking
    │   └── convenience.ts # Quick LLM/image
    │
    ├── data/             # Static data
    │   ├── nodes.ts      # Node definitions
    │   └── presets.ts    # Workflow presets
    │
    ├── schemas/          # Zod schemas
    │   └── index.ts
    │
    └── utils/            # Utilities
        ├── api-client.ts     # API communication
        ├── auth-check.ts     # Auth validation
        ├── workflow-builder.ts # Build workflows
        ├── workflow-hash.ts  # Structure hashing
        ├── template-cache.ts # Template caching
        └── logger.ts         # Logging
```

### Key Files:
- **`tools/workflows.ts`** - Create, list, execute workflows via MCP
- **`tools/convenience.ts`** - `quick_llm`, `quick_image` shortcuts
- **`utils/workflow-builder.ts`** - Auto-layout and edge generation

---

## 📁 `prisma/` - Database Schema

```
prisma/
└── schema.prisma         # Database schema definition
```

### Tables Defined:
- `users`, `workflows`, `workflow_nodes`, `workflow_edges`
- `workflow_versions`, `workflow_executions`, `node_executions`
- `quick_executions`, `credit_transactions`, `api_keys`
- `node_result_cache`, `workflow_templates`, `provider_webhooks`

---

## 📁 `docs/` - Mintlify Documentation

API documentation hosted on Mintlify.

```
docs/
├── mint.json             # Mintlify config
├── introduction.mdx      # Getting started
├── quickstart.mdx        # Quick start guide
├── authentication.mdx    # Auth documentation
├── custom.css            # Custom styles
├── logo/                 # Brand assets
└── api-reference/        # API endpoint docs
    ├── workflows/        # Workflow endpoints
    ├── executions/       # Execution endpoints
    ├── nodes/            # Node endpoints
    ├── credits/          # Credit endpoints
    └── media/            # Media endpoints
```

---

## 📁 `types/` - TypeScript Definitions

```
types/
├── index.ts              # General types
└── nodes.ts              # Node type definitions (AINodeType, etc.)
```

### Key Exports:
- `AINodeType` - All node type strings
- `NODE_DEFINITIONS` - Node metadata (costs, inputs, outputs)

---

## 📁 Other Root Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Clerk auth & route protection |
| `trigger.config.ts` | Trigger.dev configuration |
| `next.config.ts` | Next.js configuration |
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript config |
| `vercel.json` | Vercel deployment config |
| `eslint.config.mjs` | ESLint rules |
| `postcss.config.mjs` | PostCSS (Tailwind) |

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CASCADE ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐          │
│  │ Next.js │    │ tRPC    │    │Trigger  │    │   MCP   │          │
│  │   App   │◄──►│ Server  │◄──►│  .dev   │    │ Server  │          │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘          │
│       │              │              │              │                │
│       │    ┌─────────┴──────────────┴──────────────┘                │
│       │    │                                                        │
│       ▼    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                        lib/ (Core Logic)                     │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │   │
│  │  │ config/  │ │providers/│ │ workflow/│ │ services/│        │   │
│  │  │(nodes)   │ │(fal,etc) │ │(execution│ │(db ops)  │        │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │   │
│  └─────────────────────────────┬───────────────────────────────┘   │
│                                │                                    │
│                                ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Prisma + Neon PostgreSQL                  │   │
│  │  workflows │ nodes │ edges │ executions │ credits │ users   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Good luck with your interview! 🚀
