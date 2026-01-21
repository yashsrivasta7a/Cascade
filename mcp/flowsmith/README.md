# Flowsmith MCP Server

MCP (Model Context Protocol) server for Flowsmith workflow automation. Enables AI assistants to create, manage, and execute workflows.

## Features

- **17 Tools** across 6 categories
- **Automatic Authentication** - no manual API key setup needed
- **6 Preset Workflows** for quick start
- **Smart Workflow Builder** with auto-layout
- **Full CRUD Operations** for workflows
- **Execution Monitoring** and control

## Installation

```bash
cd mcp/flowsmith
npm install
npm run build
```

## Configuration

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "flowsmith": {
      "command": "node",
      "args": ["mcp/flowsmith/dist/index.js"],
      "env": {
        "FLOWSMITH_API_URL": "http://localhost:3000",
        "FLOWSMITH_API_KEY": ""
      }
    }
  }
}
```

**Note:** Leave `FLOWSMITH_API_KEY` empty - the MCP server will guide you through authentication automatically!

## First-Time Setup

When you first use the MCP server, just ask Claude to set it up:

```
User: "Create a workflow"
Claude: "I need to authenticate first. Let me help you set that up..."
       → Opens browser to flowsmith.app/auth/mcp
       → User signs in and gets a code
User: "My code is A1B2C3"
Claude: "✓ Authenticated! Now let me create your workflow..."
```

The API key is saved automatically - you only need to do this once!

## Tools

### Category 1: Authentication (2 tools)

| Tool | Description |
|------|-------------|
| `setup_auth` | Set up authentication (auto-guided flow) |
| `check_auth` | Check current authentication status |

### Category 2: Presets (Quick Start)

| Tool | Description |
|------|-------------|
| `list_presets` | List available preset workflows |
| `use_preset` | Get full workflow from a preset |

**Available Presets:**
- `llm` - Text generation with OpenRouter
- `image-gen` - Text to image with Seedream
- `video-gen` - Text to video with Seedance
- `tts` - Text to speech with ElevenLabs
- `upscale` - Image upscaling with SeedVR
- `lipsync` - Video + audio lip sync

### Category 2: Node Information

| Tool | Description |
|------|-------------|
| `list_nodes` | List all nodes (optionally by category) |
| `get_node_info` | Get detailed info about a node type |

### Category 3: Workflow Builder

| Tool | Description |
|------|-------------|
| `build_workflow` | Build workflow from node specs with auto-layout |

Example:
```json
{
  "name": "Image Gen + Upscale",
  "nodes": [
    { "type": "input", "inputType": "text" },
    { "type": "seedream" },
    { "type": "seedvr" },
    { "type": "output" }
  ]
}
```

### Category 4: Workflow CRUD

| Tool | Description |
|------|-------------|
| `list_workflows` | List saved workflows |
| `get_workflow` | Get workflow by ID |
| `create_workflow` | Save new workflow |
| `update_workflow` | Update existing workflow |
| `delete_workflow` | Delete workflow |
| `duplicate_workflow` | Copy a workflow |

### Category 5: Execution

| Tool | Description |
|------|-------------|
| `execute_workflow` | Start workflow execution |
| `get_execution` | Get execution details |
| `get_execution_status` | Quick status poll |
| `list_executions` | List recent executions |
| `cancel_execution` | Cancel running execution |

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Run directly
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLOWSMITH_API_URL` | Flowsmith API base URL | `http://localhost:3000` |
| `FLOWSMITH_API_KEY` | API key for authentication | (empty) |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
