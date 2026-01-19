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

### Provider Support

| Provider | Nodes | Features |
|----------|-------|----------|
| fal.ai | Seedream, Seedance, SeedVR | Async webhook, sync mode |
| OpenRouter | LLM | Streaming, vision support |
| ElevenLabs | TTS | Multiple voices |
| Internal | Crop, Merge, Extract | FFmpeg processing |

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
