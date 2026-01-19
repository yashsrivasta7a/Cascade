# Flowsmith

<div align="center">

![Flowsmith](public/logo.svg)

**Visual AI Workflow Builder**

Create, connect, and execute AI-powered pipelines with an intuitive node-based interface.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen?style=for-the-badge)](https://flowsmiths.vercel.app)
[![Documentation](https://img.shields.io/badge/docs-mintlify-blue?style=for-the-badge)](https://docs.flowsmiths.vercel.app)
[![Tests](https://img.shields.io/badge/tests-357%2B%20passing-success?style=for-the-badge)](#test-coverage)

</div>

---

## ✨ Features

### Visual Workflow Editor
- **Drag-and-drop** node-based interface powered by ReactFlow
- **Smart connections** with type validation and compatibility hints
- **Auto-layout** algorithm for clean DAG visualization
- **Keyboard shortcuts** for power users (copy, paste, undo, redo)
- **Multi-select** and bulk operations
- **Version history** with one-click restore

### AI Node Types
| Node | Provider | Description |
|------|----------|-------------|
| **Seedream** | fal.ai | High-quality image generation |
| **Seedance** | fal.ai | AI video generation |
| **SeedVR** | fal.ai | VR content generation |
| **OpenRouter LLM** | OpenRouter | GPT-4, Claude, Llama, Gemini |
| **ElevenLabs** | ElevenLabs | Text-to-speech synthesis |
| **Merge Videos** | Internal | Combine videos with transitions |
| **Extract Audio** | Internal | Extract audio from video |
| **Crop Image** | Internal | Crop and resize images |

### Execution Engine
- **DAG-based parallel execution** – Independent nodes run simultaneously
- **Real-time streaming** – SSE updates for live progress
- **Skip node** – Cache results and skip re-execution to save credits
- **Cascading failures** – Automatic error propagation
- **Credit tracking** – Per-execution cost breakdown

### Developer Experience
- **Config-driven nodes** – Add new nodes without writing component code
- **Type-safe API** – Full tRPC integration with Zod validation
- **Auto-generated docs** – OpenAPI spec via trpc-to-openapi
- **357+ tests** – Unit, integration, and E2E coverage

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** database (or [Neon.tech](https://neon.tech))
- **Clerk** account for authentication
- **Trigger.dev** account for background jobs

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/flowsmith.git
cd flowsmith

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Set up database
npm run db:generate
npm run db:push

# Start development servers
npm run dev          # Terminal 1: Next.js
npm run trigger:dev  # Terminal 2: Trigger.dev worker
```

Open [http://localhost:3000](http://localhost:3000) to start building workflows.

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **State** | Zustand with persistence |
| **Styling** | Tailwind CSS, Framer Motion |
| **Canvas** | ReactFlow |
| **Backend** | tRPC, Prisma, PostgreSQL |
| **Auth** | Clerk |
| **Jobs** | Trigger.dev |
| **AI** | fal.ai, OpenRouter, ElevenLabs |
| **Media** | Transloadit (CDN), FFmpeg |
| **Testing** | Vitest, Playwright |
| **Docs** | Mintlify |

---

## 📡 API Reference

Full API documentation is available at [docs.flowsmiths.vercel.app](https://docs.flowsmiths.vercel.app).

### Public Endpoints

| Category | Endpoints | Description |
|----------|-----------|-------------|
| **Workflows** | 7 | CRUD, duplicate, execute |
| **Executions** | 4 | List, get, cancel, stream |
| **Nodes** | 3 | Execute, status, LLM streaming |
| **Credits** | 2 | Balance, statistics |
| **Media** | 1 | Upload to CDN |
| **Dashboard** | 1 | Aggregate stats |

### OpenAPI Spec

```
https://flowsmiths.vercel.app/api/openapi
```

Import into Postman, Insomnia, or any OpenAPI-compatible client.

---

## 🏗️ Architecture

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

### Key Files

| Component | Location | Purpose |
|-----------|----------|---------|
| Flow Canvas | `components/flow/flow-canvas.tsx` | Main workflow editor |
| Generic Node | `components/flow/generic-node.tsx` | Unified node component |
| Node Config | `lib/config/node-config.ts` | Declarative node definitions |
| Workflow Executor | `app/trigger/workflow-executor.ts` | DAG execution engine |
| Node Executor | `app/trigger/node-executor.ts` | Individual node processing |
| Flow Store | `store/flow-store.ts` | Zustand state management |

---

## 🧪 Test Coverage

**357+ tests passing** across unit, integration, and E2E suites.

| Category | Tests | Coverage |
|----------|-------|----------|
| Unit Tests | ~310 | Type compatibility, credits, UI components |
| Integration Tests | ~46 | API endpoints, tRPC procedures |
| E2E Tests | ~45 | Auth flows, workflow editor, navigation |

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected nodes |
| `Ctrl/Cmd + V` | Paste nodes |
| `Ctrl/Cmd + S` | Save workflow |
| `Delete` | Delete selected nodes |
| `Escape` | Deselect / Cancel |
| `R` | Run workflow |
| `S` | Open shortcuts panel |
| `H` | Toggle Timeline panel |
| `A` | Toggle Asset Manager |
| `W` | Toggle Workflow sidebar |

---

## 🔐 Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://..."

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# Background Jobs (Trigger.dev)
TRIGGER_SECRET_KEY="tr_dev_..."
TRIGGER_PROJECT_REF="proj_..."

# AI Providers
FAL_KEY="..."                    # fal.ai
OPENROUTER_API_KEY="..."         # OpenRouter
ELEVENLABS_API_KEY="..."         # ElevenLabs

# Media Processing (Transloadit)
TRANSLOADIT_AUTH_KEY="..."
TRANSLOADIT_AUTH_SECRET="..."

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 📜 Scripts

```bash
# Development
npm run dev              # Start Next.js dev server
npm run trigger:dev      # Start Trigger.dev worker

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes
npm run db:studio        # Open Prisma Studio

# Testing
npm test                 # Run all tests
npm run test:coverage    # With coverage report
npm run test:e2e         # Playwright E2E tests

# Production
npm run build            # Build for production
npm run start            # Start production server

# Documentation
cd docs && npx mintlify dev  # Start docs locally
```

---

## 📄 License

Private project - All rights reserved.

---

<div align="center">

**[Live Demo](https://flowsmiths.vercel.app)** · **[Documentation](https://docs.flowsmiths.vercel.app)** · **[API Reference](https://flowsmiths.vercel.app/api/openapi)**

</div>
