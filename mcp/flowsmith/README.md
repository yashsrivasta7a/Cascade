# Flowsmith MCP Server

MCP (Model Context Protocol) server for [Flowsmith](https://flowsmiths.vercel.app) - AI workflow automation platform. Enables AI assistants like Claude, Cursor, and others to create, manage, and execute workflows.

## Quick Install (For Users)

### Option 1: NPX (Easiest - Coming Soon)
```bash
npx @flowsmith/mcp-server
```

### Option 2: Manual Installation

1. **Clone or download the MCP server:**
```bash
git clone https://github.com/YOUR_USERNAME/flowsmith.git
cd flowsmith/mcp/flowsmith
npm install
npm run build
```

2. **Add to your AI assistant** (see Configuration below)

3. **Authenticate** - The MCP will guide you through this automatically!

---

## Configuration

### For Cursor IDE

Add to your `.cursor/mcp.json` (create the file if it doesn't exist):

```json
{
  "mcpServers": {
    "flowsmith": {
      "command": "node",
      "args": ["/absolute/path/to/flowsmith/mcp/flowsmith/dist/index.js"],
      "env": {
        "FLOWSMITH_API_KEY": ""
      }
    }
  }
}
```

### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "flowsmith": {
      "command": "node",
      "args": ["/absolute/path/to/flowsmith/mcp/flowsmith/dist/index.js"],
      "env": {
        "FLOWSMITH_API_KEY": ""
      }
    }
  }
}
```

### For Other MCP Clients

Use these settings:
- **Command:** `node`
- **Args:** `["/path/to/mcp/flowsmith/dist/index.js"]`
- **Environment:**
  - `FLOWSMITH_API_KEY`: Leave empty (auto-setup)
  - `FLOWSMITH_API_URL`: `https://flowsmiths.vercel.app` (default)

---

## First-Time Authentication

When you first use the MCP server, authentication is guided automatically:

```
You: "Create a workflow to generate images"

Claude: "I need to authenticate with Flowsmith first. 
        Please go to your Flowsmith Settings > API Keys and create one.
        Then tell me the API key."

You: "Here's my key: sk_live_abc123..."

Claude: "✓ Authenticated! Now let me create your workflow..."
```

**To get your API key:**
1. Go to [flowsmiths.vercel.app](https://flowsmiths.vercel.app)
2. Sign in to your account
3. Go to **Settings** > **API Keys**
4. Click **Create API Key**
5. Copy and share with your AI assistant

---

## Features

| Category | Tools |
|----------|-------|
| **Quick Actions** | `quick_llm`, `quick_image` - One-liner AI generation |
| **Workflow Builder** | `build_workflow`, `save_and_execute` - Create custom workflows |
| **Workflow Management** | `list_workflows`, `get_workflow`, `create_workflow`, `update_workflow`, `delete_workflow`, `duplicate_workflow` |
| **Execution** | `execute_workflow`, `get_execution`, `get_execution_result`, `list_executions`, `cancel_execution` |
| **Templates** | `list_presets`, `use_preset`, `find_workflow_template`, `list_workflow_templates` |
| **Nodes** | `list_nodes`, `get_node_info` - Explore available AI nodes |
| **Credits** | `get_credits`, `get_credit_stats` - Check balance |
| **Media** | `upload_media` - Upload images/videos/audio |
| **Auth** | `setup_auth`, `check_auth` |

---

## Example Usage

### Quick LLM Chat
```
"Use quick_llm to answer: What is the meaning of life?"
```

### Quick Image Generation
```
"Use quick_image to generate: a sunset over mountains"
```

### Build Custom Workflow
```
"Build a workflow that takes text input, generates an image, upscales it, and outputs the result"
```

### Execute Existing Workflow
```
"List my workflows and run the image generation one with prompt 'a cyberpunk city'"
```

---

## Available Node Types

| Category | Nodes |
|----------|-------|
| **LLM** | `openrouter` (GPT-4, Claude, Llama, etc.) |
| **Image** | `seedream` (text-to-image), `seedvr` (upscale), `crop-image` |
| **Video** | `seedance` (text/image-to-video), `lipsync`, `merge-videos` |
| **Audio** | `elevenlabs` (TTS), `extract-audio`, `merge-audio-video` |
| **I/O** | `input`, `output` |

---

## Development

```bash
cd mcp/flowsmith

# Install dependencies
npm install

# Build
npm run build

# Watch mode (for development)
npm run dev

# Run directly
npm start
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLOWSMITH_API_URL` | API base URL | `https://flowsmiths.vercel.app` |
| `FLOWSMITH_API_KEY` | Your API key | (empty - auto-setup) |
| `LOG_LEVEL` | Logging level | `info` |

---

## Sharing This MCP

### For Teammates/Collaborators

1. Share this folder (`mcp/flowsmith/`) or the full repo
2. They run `npm install && npm run build`
3. They add the config to their AI assistant
4. Each person uses their own API key from Flowsmith

### Publishing to npm (Optional)

```bash
cd mcp/flowsmith
npm login
npm publish --access public
```

Then users can install with:
```bash
npm install -g @flowsmith/mcp-server
```

---

## Troubleshooting

### "Authentication required" error
→ Use the `setup_auth` tool or provide your API key from Flowsmith Settings

### "API call failed: 401"
→ Your API key may be invalid or expired. Create a new one at Settings > API Keys

### MCP not showing in Claude/Cursor
→ Restart the application after adding the config
→ Check the path to `dist/index.js` is correct

---

## Links

- **Flowsmith App:** https://flowsmiths.vercel.app
- **API Docs:** https://flowsmiths.vercel.app/docs
- **Support:** Create an issue on GitHub

---

Built with ❤️ for AI-powered workflow automation
