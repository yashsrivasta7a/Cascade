# Cascade MCP Documentation

A comprehensive Model Context Protocol (MCP) server for building and executing AI-powered media workflows.

---

## Table of Contents

1. [Overview](#overview)
2. [Available Tools](#available-tools)
3. [Available Nodes](#available-nodes)
4. [Pre-built Workflow Templates](#pre-built-workflow-templates)
5. [Workflow Presets](#workflow-presets)
6. [Special Features](#special-features)
7. [Optimizations](#optimizations)
8. [Example Use Cases](#example-use-cases)

---

## Overview

Cascade MCP enables AI assistants to:
- Build custom media processing workflows
- Execute workflows with user inputs
- Generate images, videos, and audio
- Process and transform media files
- Access multiple AI providers through a unified interface

---

## Available Tools

### Quick Tools (One-Step Operations)

| Tool | Description | Use Case |
|------|-------------|----------|
| `quick_llm` | Fast LLM text generation | Quick AI responses without workflow setup |
| `quick_image` | Fast image generation | Generate images with a single prompt |
| `quick_vision` | Analyze/describe images with AI | OCR, image description, chart analysis |

### Media Upload Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `upload_media` | Upload base64 data to CDN | Convert data URLs to permanent URLs |
| `upload_local_file` | Upload local files to CDN | Upload images/videos/audio from disk |
| `analyze_local_image` | Upload + analyze local image | One-step local image analysis with vision AI |

### Workflow Management

| Tool | Description |
|------|-------------|
| `list_workflows` | List all saved workflows |
| `get_workflow` | Get workflow details by ID |
| `create_workflow` | Save a new workflow |
| `update_workflow` | Modify an existing workflow |
| `delete_workflow` | Remove a workflow |
| `duplicate_workflow` | Clone an existing workflow |

### Workflow Building

| Tool | Description |
|------|-------------|
| `build_workflow` | Build a workflow from node specifications |
| `save_and_execute` | Build, save, and run in one step |
| `find_workflow_template` | Search for pre-built templates by query |
| `list_workflow_templates` | List all available templates |
| `get_cache_stats` | View template cache statistics |

### Workflow Execution

| Tool | Description |
|------|-------------|
| `execute_workflow` | Start a workflow execution |
| `get_execution` | Get execution details |
| `get_execution_status` | Quick status check |
| `get_execution_result` | Get final output (auto-polls until complete) |
| `list_executions` | List recent executions |
| `cancel_execution` | Stop a running execution |
| `retry_execution` | Retry a failed execution |

### Node & Preset Information

| Tool | Description |
|------|-------------|
| `list_nodes` | List all available nodes (optionally by category) |
| `get_node_info` | Get detailed info about a specific node |
| `list_presets` | List available workflow presets |
| `use_preset` | Get a complete workflow from a preset |

### Account & Credits

| Tool | Description |
|------|-------------|
| `get_credits` | Check current credit balance |
| `get_credit_stats` | View spending history and statistics |
| `check_auth` | Verify authentication status |
| `setup_auth` | Configure API key authentication |

---

## Available Nodes

### Image Nodes

| Node | Provider | Action | Description | Est. Cost |
|------|----------|--------|-------------|-----------|
| `seedream` | fal.ai | Text → Image | High-quality image generation with Seedream 4.5 | 40,000 |
| `seedvr` | fal.ai | Image → Image | AI-powered upscaling (2x/4x) with face enhancement | 2,000 |
| `crop-image` | local | Image → Image | Percentage-based image cropping | 1,000 |

### Video Nodes

| Node | Provider | Action | Description | Est. Cost |
|------|----------|--------|-------------|-----------|
| `seedance` | fal.ai | Text → Video | Generate cinematic videos from prompts | 260,000 |
| `lipsync` | fal.ai | Video + Audio → Video | AI lip synchronization | 100,000 |
| `merge-videos` | transloadit | Video + Video → Video | Concatenate videos with transitions | 10,000 |
| `merge-audio-video` | transloadit | Video + Audio → Video | Combine audio/video tracks | 5,000 |

### Audio Nodes

| Node | Provider | Action | Description | Est. Cost |
|------|----------|--------|-------------|-----------|
| `elevenlabs` | fal.ai | Text → Audio | Ultra-realistic TTS with emotion control | 50,000 |
| `extract-audio` | transloadit | Video → Audio | Extract audio from video | 5,000 |

### LLM Nodes

| Node | Provider | Action | Description | Est. Cost |
|------|----------|--------|-------------|-----------|
| `openrouter` | OpenRouter | Text → Text | Access GPT-4, Claude, Gemini via unified API | 50,000 |

### I/O Nodes

| Node | Description |
|------|-------------|
| `input` | Universal input (text, image, video, audio) |
| `image-input` | Image-specific input |
| `video-input` | Video-specific input |
| `audio-input` | Audio-specific input |
| `output` | Display and download workflow results |

---

## Pre-built Workflow Templates

These templates are **pre-seeded** and can be found instantly using `find_workflow_template`:

| Template | Nodes | Keywords |
|----------|-------|----------|
| **Video Merge** | input → input → merge-videos → output | "merge video", "combine video", "join video" |
| **Audio Video Merge** | input → input → merge-audio-video → output | "merge audio video", "add audio", "voiceover" |
| **Lipsync** | input → input → lipsync → output | "lipsync", "lip sync", "talking head" |
| **Text to Image** | input → seedream → output | "generate image", "text to image" |
| **Text to Speech** | input → elevenlabs → output | "text to speech", "tts", "voice" |
| **Image Upscale** | input → seedvr → output | "upscale", "enhance", "super resolution" |
| **Text to Video** | input → seedance → output | "text to video", "generate video" |
| **LLM Chat** | input → openrouter → output | "llm", "chat", "gpt", "claude" |

---

## Workflow Presets

Quick-start presets available via `use_preset`:

| Preset ID | Name | Description |
|-----------|------|-------------|
| `llm` | LLM Text Generation | Generate text with GPT-4, Claude, etc. |
| `image-gen` | Text to Image | Generate images with Seedream 4.5 |
| `video-gen` | Text to Video | Generate videos with Seedance 1.5 |
| `tts` | Text to Speech | Convert text to speech with ElevenLabs |
| `upscale` | Image Upscaler | Upscale images with SeedVR 2 |
| `lipsync` | Lip Sync Video | Sync video lips to audio |

---

## Special Features

### 1. Vision/OCR Capability
**Quick method:** Use `quick_vision` tool for one-step image analysis.
**Workflow method:** Use `openrouter` with GPT-4o in a workflow:
```
input (image) → crop-image (optional) → openrouter (vision) → output
```

### 2. Multi-Input Workflows
Nodes like `merge-videos`, `merge-audio-video`, and `lipsync` accept multiple inputs that are automatically wired correctly.

### 3. Automatic Edge Generation
The `build_workflow` tool automatically:
- Detects node input/output types
- Creates proper connections between nodes
- Handles multi-input nodes (video1, video2, etc.)

### 4. Execution Polling
`get_execution_result` automatically polls until completion with configurable timeout.

### 5. Credit Tracking
All operations track credit usage with detailed statistics available via `get_credit_stats`.

### 6. Formatted Output Tables
Execution results include `_formattedOutput` with markdown tables:
- **Pipeline table**: Shows each node's step #, type, status, and output preview
- **Assets table**: Lists all generated media (images, videos, audio) with URLs

---

## Optimizations

### 1. Database Template Caching
- **Model**: `WorkflowTemplate` stores workflow structures
- **Hash**: SHA-256 hash of canonical node/edge structure
- **Deduplication**: Same structure = same template, just increment usage count

### 2. Structure Hashing
- Position-independent hashing
- ID-independent hashing
- Only node types and connections matter
- Deterministic hash generation

### 3. Multi-Input Edge Auto-Wiring
Fixed automatic edge generation for multi-input nodes:
```typescript
MULTI_INPUT_NODES = {
  "merge-videos": { inputs: ["video1", "video2"], types: ["video", "video"] },
  "merge-audio-video": { inputs: ["video", "audio"], types: ["video", "audio"] },
  "lipsync": { inputs: ["video", "audio"], types: ["video", "audio"] }
}
```

### 4. Pre-seeded Templates (8 Templates)
Popular workflows are pre-loaded for instant access:
- Video Merge
- Audio Video Merge
- Lipsync
- Text to Image
- Text to Speech
- Image Upscale
- Text to Video
- LLM Chat

### 5. Semantic/Keyword Matching
Natural language queries match templates:
- "merge two videos" → Video Merge template
- "add audio to video" → Audio Video Merge template
- "generate an image" → Text to Image template

### 6. In-Memory LRU Cache
- **Size**: 50 entries
- **Strategy**: Least Recently Used eviction
- **Tracking**: Hit count per entry
- **Priority**: Memory → Database → Pre-seeded → Build fresh

### Cache Lookup Priority
```
User Request
     ↓
1. Memory Cache (fastest)
     ↓ miss
2. Database Cache
     ↓ miss  
3. Pre-seeded Templates
     ↓ miss
4. Semantic Pattern Match
     ↓ miss
5. Build Fresh Workflow
     ↓
Save to DB + Memory Cache
```

### Response Metadata
All `build_workflow` and `create_workflow` responses include:
```json
{
  "fromCache": "memory" | "database" | "preseeded" | "built",
  "structureHash": "1d7258bd32b391f1",
  "templateUsageCount": 3,
  "templateCached": true
}
```

---

## Example Use Cases

### 1. Generate an Image
```
Tool: quick_image
Input: "a beautiful sunset over mountains"
```

### 2. Merge Two Videos
```
Tool: save_and_execute
Nodes: [
  { type: "input", inputType: "video" },
  { type: "input", inputType: "video" },
  { type: "merge-videos" },
  { type: "output" }
]
Inputs: { "input-1": "video1.mp4", "input-2": "video2.mp4" }
```

### 3. Extract Text from Image (OCR)
```
Tool: build_workflow
Nodes: [
  { type: "input", inputType: "image" },
  { type: "crop-image" },
  { type: "openrouter", config: { model: "openai/gpt-4o" } },
  { type: "output" }
]
```

### 4. Create Talking Head Video
```
Tool: find_workflow_template
Query: "lipsync"
→ Returns Lipsync template
→ Execute with video + audio inputs
```

### 5. Text to Video Pipeline
```
Tool: save_and_execute
Nodes: [
  { type: "input", inputType: "text" },
  { type: "seedance" },
  { type: "output" }
]
Inputs: { "input-1": "A cat walking on the moon" }
```

### 6. Analyze Image with Vision AI
```
Tool: quick_vision
Input: {
  image: "https://example.com/image.jpg",
  prompt: "What text is in this image?"
}
```

### 7. Upload and Analyze Local File
```
Tool: analyze_local_image
Input: {
  path: "D:/images/screenshot.png",
  prompt: "Extract all text from this screenshot"
}
```

### 8. Upload Media to CDN
```
Tool: upload_media
Input: {
  data: "data:image/png;base64,iVBORw0..."
}
→ Returns: { url: "https://cdn.example.com/image.png" }
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `mcp/cascade/src/tools/builder.ts` | Workflow building tools |
| `mcp/cascade/src/tools/workflows.ts` | Workflow CRUD operations |
| `mcp/cascade/src/tools/executions.ts` | Execution management |
| `mcp/cascade/src/utils/template-cache.ts` | Caching system |
| `mcp/cascade/src/utils/workflow-hash.ts` | Structure hashing |
| `mcp/cascade/src/utils/workflow-builder.ts` | Edge auto-generation |
| `mcp/cascade/src/data/nodes.ts` | Node definitions |
| `app/api/workflow-templates/route.ts` | Template API |
| `prisma/schema.prisma` | WorkflowTemplate model |

---

*Last updated: January 2026*
