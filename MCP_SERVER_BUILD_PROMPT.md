# MCP Server Build Specification

> A comprehensive guide to building a Model Context Protocol (MCP) server for AI assistant integration. Give this to Cursor/Claude to build your own MCP server.

---

## Overview

Build an MCP server that allows AI assistants (like Claude in Cursor) to interact with your API. The server exposes "tools" that the AI can call to perform actions on behalf of users.

**What you're building:**
- A Node.js TypeScript server that communicates via JSON-RPC over stdio
- Tools that AI assistants can discover and call
- Authentication system to connect to your backend API
- Utility functions for API communication

---

## Project Structure

Create this folder structure:

```
mcp/your-project/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts              # Entry point
    ├── server.ts             # MCP server setup
    ├── tools/                # Tool definitions & handlers
    │   ├── auth.ts           # Authentication tools
    │   ├── [feature].ts      # Feature-specific tools
    │   └── ...
    ├── data/                 # Static data/definitions
    │   └── [entities].ts
    ├── schemas/              # Zod schemas for validation
    │   └── index.ts
    └── utils/                # Utility functions
        ├── api-client.ts     # HTTP client for your API
        ├── auth-check.ts     # Auth validation utilities
        └── logger.ts         # Logging (MUST use stderr)
```

---

## Step 1: Package Configuration

### package.json

```json
{
  "name": "@your-org/mcp-server",
  "version": "1.0.0",
  "description": "MCP server for [Your Product] integration",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 2: Entry Point (src/index.ts)

```typescript
#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

/**
 * MCP Server Entry Point
 * 
 * This server provides tools for:
 * - [List your main features]
 * - Authentication
 * - CRUD operations
 * - etc.
 */

async function main() {
  logger.info("Starting MCP Server...");

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("MCP Server connected and ready");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    logger.info("Shutting down...");
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Shutting down...");
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
```

---

## Step 3: Server Setup (src/server.ts)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./utils/logger.js";
import { toolRequiresAuth, isAuthenticated, getAuthRequiredResponse } from "./utils/auth-check.js";

// Import tool handlers from each tool file
import { registerAuthTools, authToolDefinitions } from "./tools/auth.js";
import { registerFeatureTools, featureToolDefinitions } from "./tools/feature.js";
// ... import more tools

/**
 * Create and configure the MCP server with all tools
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: "your-project",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Collect all tool definitions
  const allToolDefinitions = [
    ...authToolDefinitions,      // Auth tools first for discoverability
    ...featureToolDefinitions,   // Your feature tools
    // ... more tool definitions
  ];

  // Register list tools handler - returns all available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools", { count: allToolDefinitions.length });
    return {
      tools: allToolDefinitions,
    };
  });

  // Create tool handlers map
  const toolHandlers = new Map<string, (args: unknown) => Promise<unknown>>();

  // Register all tool handlers
  registerAuthTools(toolHandlers);
  registerFeatureTools(toolHandlers);
  // ... register more tools

  // Register call tool handler - executes a specific tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    logger.info(`Tool called: ${name}`, { args });

    const handler = toolHandlers.get(name);
    if (!handler) {
      logger.error(`Unknown tool: ${name}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
        isError: true,
      };
    }

    // Check authentication for tools that require it
    if (toolRequiresAuth(name) && !isAuthenticated()) {
      logger.warn(`Tool ${name} requires authentication`);
      const authResponse = getAuthRequiredResponse();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(authResponse, null, 2),
          },
        ],
      };
    }

    try {
      const result = await handler(args);
      logger.debug(`Tool ${name} completed successfully`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Tool ${name} failed`, { error: errorMessage });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: errorMessage }),
          },
        ],
        isError: true,
      };
    }
  });

  logger.info(`Server configured with ${allToolDefinitions.length} tools`);

  return server;
}
```

---

## Step 4: Logger Utility (src/utils/logger.ts)

**CRITICAL: All logs MUST go to stderr, NOT stdout. Stdout is reserved for JSON-RPC communication.**

```typescript
/**
 * Logger utility for MCP server
 * IMPORTANT: All logs go to stderr, NOT stdout
 * stdout is reserved for JSON-RPC communication
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  
  if (data !== undefined) {
    return `${prefix} ${message} ${JSON.stringify(data)}`;
  }
  return `${prefix} ${message}`;
}

export const logger = {
  debug(message: string, data?: unknown): void {
    if (shouldLog("debug")) {
      console.error(formatMessage("debug", message, data));  // stderr!
    }
  },

  info(message: string, data?: unknown): void {
    if (shouldLog("info")) {
      console.error(formatMessage("info", message, data));   // stderr!
    }
  },

  warn(message: string, data?: unknown): void {
    if (shouldLog("warn")) {
      console.error(formatMessage("warn", message, data));   // stderr!
    }
  },

  error(message: string, data?: unknown): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", message, data));  // stderr!
    }
  },
};
```

---

## Step 5: Authentication (src/utils/auth-check.ts)

```typescript
import { logger } from "./logger.js";

// Environment variables for API connection
const API_BASE = process.env.YOUR_API_URL || "http://localhost:3000";
const API_KEY = process.env.YOUR_API_KEY || "";

export interface AuthStatus {
  authenticated: boolean;
  apiKey: string | null;
  error?: string;
}

/**
 * Check if API key is configured
 */
export function isAuthenticated(): boolean {
  return Boolean(API_KEY && API_KEY.startsWith("sk_live_"));
}

/**
 * Get current auth status with details
 */
export function getAuthStatus(): AuthStatus {
  if (!API_KEY) {
    return {
      authenticated: false,
      apiKey: null,
      error: "No API key configured",
    };
  }

  if (!API_KEY.startsWith("sk_live_")) {
    return {
      authenticated: false,
      apiKey: API_KEY.substring(0, 8) + "...",
      error: "Invalid API key format",
    };
  }

  return {
    authenticated: true,
    apiKey: API_KEY.substring(0, 12) + "...",
  };
}

/**
 * Get auth required response for unauthenticated requests
 */
export function getAuthRequiredResponse() {
  const settingsUrl = `${API_BASE}/settings`;
  
  return {
    error: "AUTHENTICATION_REQUIRED",
    authenticated: false,
    message: "You need an API key to use this feature.",
    instructions: [
      `1. Go to Settings: ${settingsUrl}`,
      "2. Navigate to 'API Keys' section",
      "3. Click 'Create API Key' (or copy an existing one)",
      "4. Tell me: 'My API key is sk_live_...'",
    ],
    settingsUrl,
    hint: "Get your API key from Settings > API Keys, then say 'my API key is sk_live_...'",
  };
}

/**
 * List of tools that DON'T require authentication (read-only, local operations)
 */
export const PUBLIC_TOOLS = new Set([
  "setup_auth",
  "check_auth",
  // Add other tools that don't need auth
]);

/**
 * Check if a tool requires authentication
 */
export function toolRequiresAuth(toolName: string): boolean {
  return !PUBLIC_TOOLS.has(toolName);
}
```

---

## Step 6: API Client (src/utils/api-client.ts)

```typescript
import { logger } from "./logger.js";

const API_BASE = process.env.YOUR_API_URL || "http://localhost:3000";
const API_KEY = process.env.YOUR_API_KEY || "";

/**
 * Check if API key is configured and throw helpful error if not
 */
export function requireAuth(operation: string): void {
  if (!API_KEY) {
    throw new Error(
      `AUTHENTICATION REQUIRED: Cannot ${operation} without an API key. ` +
      `Please use the "setup_auth" tool to authenticate first.`
    );
  }
}

/**
 * Handle auth errors from API responses
 */
function handleAuthError(status: number, errorText: string, operation: string): never {
  if (status === 401 || status === 403 || status === 404) {
    if (!API_KEY || errorText.includes("Unauthorized") || errorText.includes("Not found")) {
      throw new Error(
        `AUTHENTICATION FAILED: ${operation} failed (${status}). ` +
        `Your API key may be missing, invalid, or expired. ` +
        `Please use the "setup_auth" tool to re-authenticate.`
      );
    }
  }
  throw new Error(`API call failed: ${status} ${errorText}`);
}

/**
 * Make a REST API call
 */
export async function restCall<T>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  // Non-GET requests require authentication
  if (method !== "GET") {
    requireAuth(`${method} ${path}`);
  }
  
  const url = `${API_BASE}${path}`;

  logger.debug(`REST ${method}: ${path}`, { body });

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "Authorization": `Bearer ${API_KEY}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(`REST call failed: ${path}`, { status: response.status, error: errorText });
    handleAuthError(response.status, errorText, `${method} ${path}`);
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}

// =============================================================================
// API-SPECIFIC FUNCTIONS
// Define typed functions for each API endpoint
// =============================================================================

export interface ListItemsResponse {
  items: Array<{
    id: string;
    name: string;
    // ... other fields
  }>;
}

export async function listItems(): Promise<ListItemsResponse> {
  return restCall<ListItemsResponse>("/api/v1/items", "GET");
}

export async function getItem(id: string): Promise<{ item: unknown }> {
  return restCall<{ item: unknown }>(`/api/v1/items/${id}`, "GET");
}

export async function createItem(data: unknown): Promise<{ item: unknown }> {
  return restCall<{ item: unknown }>("/api/v1/items", "POST", data);
}

export async function updateItem(id: string, data: unknown): Promise<{ item: unknown }> {
  return restCall<{ item: unknown }>(`/api/v1/items/${id}`, "PATCH", data);
}

export async function deleteItem(id: string): Promise<{ success: boolean }> {
  return restCall<{ success: boolean }>(`/api/v1/items/${id}`, "DELETE");
}
```

---

## Step 7: Tool Definitions Pattern (src/tools/[feature].ts)

Each tool file follows this pattern:

```typescript
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { listItems, getItem, createItem, updateItem, deleteItem } from "../utils/api-client.js";
import { logger } from "../utils/logger.js";

// =============================================================================
// TOOL DEFINITIONS
// These define what tools are available and their input schemas
// =============================================================================

export const featureToolDefinitions: Tool[] = [
  {
    name: "list_items",
    description: "List all items for the current user. Returns ID, name, and metadata.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_item",
    description: "Get a specific item by ID including full details.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The item ID",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "create_item",
    description: "Create a new item with the specified properties.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the item",
        },
        description: {
          type: "string",
          description: "Optional description",
        },
        // Add more properties as needed
      },
      required: ["name"],
    },
  },
  {
    name: "update_item",
    description: "Update an existing item. Only provided fields will be updated.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The item ID to update",
        },
        name: {
          type: "string",
          description: "New name (optional)",
        },
        description: {
          type: "string",
          description: "New description (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_item",
    description: "Permanently delete an item by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The item ID to delete",
        },
      },
      required: ["id"],
    },
  },
];

// =============================================================================
// TOOL HANDLERS
// These implement the actual logic for each tool
// =============================================================================

interface GetItemArgs {
  id: string;
}

interface CreateItemArgs {
  name: string;
  description?: string;
}

interface UpdateItemArgs {
  id: string;
  name?: string;
  description?: string;
}

interface DeleteItemArgs {
  id: string;
}

/**
 * Register tool handlers
 */
export function registerFeatureTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  
  // list_items
  handlers.set("list_items", async () => {
    logger.debug("Listing items");
    
    try {
      const result = await listItems();
      
      return {
        items: result.items.map((item) => ({
          id: item.id,
          name: item.name,
          // ... map other fields
        })),
        count: result.items.length,
      };
    } catch (error) {
      logger.error("Failed to list items", error);
      throw new Error(`Failed to list items: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // get_item
  handlers.set("get_item", async (args: unknown) => {
    const { id } = args as GetItemArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Getting item: ${id}`);
    
    try {
      const result = await getItem(id);
      return result;
    } catch (error) {
      logger.error(`Failed to get item: ${id}`, error);
      throw new Error(`Failed to get item: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // create_item
  handlers.set("create_item", async (args: unknown) => {
    const { name, description } = args as CreateItemArgs;
    
    if (!name) {
      throw new Error("Missing required parameter: name");
    }

    logger.debug(`Creating item: ${name}`);
    
    try {
      const result = await createItem({ name, description });
      
      return {
        success: true,
        ...result,
        message: `Item "${name}" created successfully`,
      };
    } catch (error) {
      logger.error(`Failed to create item: ${name}`, error);
      throw new Error(`Failed to create item: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // update_item
  handlers.set("update_item", async (args: unknown) => {
    const { id, name, description } = args as UpdateItemArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Updating item: ${id}`);
    
    try {
      const updateData: Record<string, unknown> = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;

      const result = await updateItem(id, updateData);
      
      return {
        success: true,
        ...result,
        message: `Item updated successfully`,
      };
    } catch (error) {
      logger.error(`Failed to update item: ${id}`, error);
      throw new Error(`Failed to update item: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // delete_item
  handlers.set("delete_item", async (args: unknown) => {
    const { id } = args as DeleteItemArgs;
    
    if (!id) {
      throw new Error("Missing required parameter: id");
    }

    logger.debug(`Deleting item: ${id}`);
    
    try {
      await deleteItem(id);
      
      return {
        success: true,
        message: `Item ${id} deleted successfully`,
      };
    } catch (error) {
      logger.error(`Failed to delete item: ${id}`, error);
      throw new Error(`Failed to delete item: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
```

---

## Step 8: Authentication Tools (src/tools/auth.ts)

```typescript
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../utils/logger.js";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";

// =============================================================================
// AUTH TOOL DEFINITIONS
// =============================================================================

export const authToolDefinitions: Tool[] = [
  {
    name: "setup_auth",
    description: `Set up authentication for the MCP server. 

The user needs to provide their API key from Settings > API Keys.
If they don't have one, they can create it there.

Use this when authentication fails or when first setting up the MCP server.`,
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "The API key from Settings (starts with 'sk_live_').",
        },
      },
      required: [],
    },
  },
  {
    name: "check_auth",
    description: "Check if the MCP server is authenticated. Returns the authentication status and user email if authenticated.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE = process.env.YOUR_API_URL || "http://localhost:3000";
const API_KEY = process.env.YOUR_API_KEY || "";

// Find the MCP config file path
function getMcpConfigPath(): string {
  const possiblePaths = [
    // Cursor config in workspace
    join(process.cwd(), ".cursor", "mcp.json"),
    // Cursor global config (Windows)
    join(homedir(), "AppData", "Roaming", "Cursor", "User", "globalStorage", "mcp.json"),
    // Cursor global config (macOS)
    join(homedir(), "Library", "Application Support", "Cursor", "User", "globalStorage", "mcp.json"),
    // Cursor global config (Linux)
    join(homedir(), ".config", "Cursor", "User", "globalStorage", "mcp.json"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  return join(process.cwd(), ".cursor", "mcp.json");
}

// =============================================================================
// AUTH TOOL HANDLERS
// =============================================================================

interface SetupAuthArgs {
  apiKey?: string;
}

/**
 * Update MCP config with new API key
 */
function updateMcpConfig(apiKey: string): { success: boolean; path: string } {
  const configPath = getMcpConfigPath();
  
  logger.info(`Updating MCP config at: ${configPath}`);

  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    } catch (e) {
      logger.warn("Could not parse existing config, creating new one");
    }
  }

  const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
  const serverConfig = (mcpServers["your-project"] || {}) as Record<string, unknown>;
  const env = (serverConfig.env || {}) as Record<string, string>;

  env.YOUR_API_KEY = apiKey;
  serverConfig.env = env;

  if (!serverConfig.command) {
    serverConfig.command = "node";
  }
  if (!serverConfig.args) {
    serverConfig.args = ["mcp/your-project/dist/index.js"];
  }
  if (!env.YOUR_API_URL) {
    env.YOUR_API_URL = "http://localhost:3000";
  }

  mcpServers["your-project"] = serverConfig;
  config.mcpServers = mcpServers;

  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  return { success: true, path: configPath };
}

/**
 * Validate current API key
 */
async function validateApiKey(): Promise<{ valid: boolean }> {
  if (!API_KEY) {
    return { valid: false };
  }

  try {
    const response = await fetch(`${API_BASE}/api/v1/health`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    return { valid: response.ok };
  } catch {
    return { valid: false };
  }
}

/**
 * Register auth tool handlers
 */
export function registerAuthTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  
  handlers.set("setup_auth", async (args: unknown) => {
    const { apiKey } = (args as SetupAuthArgs) || {};

    if (apiKey) {
      if (!apiKey.startsWith("sk_live_")) {
        return {
          status: "error",
          message: `Invalid API key format. Keys should start with "sk_live_".`,
          hint: "Go to Settings > API Keys to get or create your key.",
          settingsUrl: `${API_BASE}/settings`,
        };
      }

      try {
        const configResult = updateMcpConfig(apiKey);

        return {
          status: "success",
          message: `API key configured successfully!`,
          configPath: configResult.path,
          apiKeyPrefix: apiKey.substring(0, 12) + "...",
          nextSteps: [
            "Your API key has been saved to the MCP configuration.",
            "Please restart Cursor to apply the changes.",
            "After restarting, you can use all MCP tools!",
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          status: "error",
          message: `Failed to save API key: ${message}`,
        };
      }
    }

    const settingsUrl = `${API_BASE}/settings`;
    
    return {
      status: "needs_api_key",
      message: "To use this MCP server, you need an API key.",
      instructions: [
        `1. Go to Settings: ${settingsUrl}`,
        "2. Navigate to 'API Keys' section",
        "3. Click 'Create API Key' (or copy an existing one)",
        "4. Tell me: 'My API key is sk_live_...'",
      ],
      settingsUrl,
      hint: "Once you have the key, just say 'my API key is sk_live_...'",
    };
  });

  handlers.set("check_auth", async () => {
    logger.debug("Checking authentication status");

    const hasKey = Boolean(API_KEY);
    
    if (!hasKey) {
      return {
        authenticated: false,
        message: "No API key configured. Use the setup_auth tool to authenticate.",
        hint: "Say 'set up auth' to get started.",
      };
    }

    const validation = await validateApiKey();

    if (validation.valid) {
      return {
        authenticated: true,
        message: "Authenticated and ready to use!",
        apiKeyPrefix: API_KEY.substring(0, 12) + "...",
      };
    } else {
      return {
        authenticated: false,
        message: "API key is configured but appears to be invalid or expired.",
        hint: "Use setup_auth to re-authenticate.",
        apiKeyPrefix: API_KEY.substring(0, 12) + "...",
      };
    }
  });
}
```

---

## Step 9: Schemas (src/schemas/index.ts)

```typescript
import { z } from "zod";

// =============================================================================
// SHARED SCHEMAS
// =============================================================================

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ItemListSchema = z.object({
  items: z.array(ItemSchema),
  count: z.number(),
});

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

export const CreateItemInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const UpdateItemInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Item = z.infer<typeof ItemSchema>;
export type ItemList = z.infer<typeof ItemListSchema>;
export type CreateItemInput = z.infer<typeof CreateItemInputSchema>;
export type UpdateItemInput = z.infer<typeof UpdateItemInputSchema>;
```

---

## Step 10: Convenience Tools (Optional)

For a better user experience, create high-level tools that combine multiple operations:

```typescript
export const convenienceToolDefinitions: Tool[] = [
  {
    name: "quick_action",
    description: `Perform a common action in one step.
    
Just provide what you want to do and it handles the rest.`,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "What action to perform",
        },
        input: {
          type: "string",
          description: "The input for the action",
        },
      },
      required: ["action", "input"],
    },
  },
];
```

---

## Step 11: Configuration for Cursor

Create `.cursor/mcp.json` in the user's project:

```json
{
  "mcpServers": {
    "your-project": {
      "command": "node",
      "args": ["mcp/your-project/dist/index.js"],
      "env": {
        "YOUR_API_URL": "https://your-api.com",
        "YOUR_API_KEY": ""
      }
    }
  }
}
```

---

## Step 12: README.md

````markdown
# Your Project MCP Server

MCP server for integrating with AI assistants like Claude in Cursor.

## Features

- **X Tools** across Y categories
- **Automatic Authentication** - guided setup flow
- **Full CRUD Operations** for your entities
- **[Your specific features]**

## Installation

```bash
cd mcp/your-project
npm install
npm run build
```

## Configuration

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "your-project": {
      "command": "node",
      "args": ["mcp/your-project/dist/index.js"],
      "env": {
        "YOUR_API_URL": "https://your-api.com",
        "YOUR_API_KEY": ""
      }
    }
  }
}
```

## First-Time Setup

When you first use the MCP server, just ask Claude to set it up:

```
User: "Create an item"
Claude: "I need to authenticate first. Let me help you set that up..."
User: "My API key is sk_live_..."
Claude: "✓ Authenticated! Now let me create your item..."
```

## Tools

### Authentication

| Tool | Description |
|------|-------------|
| `setup_auth` | Set up authentication |
| `check_auth` | Check auth status |

### CRUD Operations

| Tool | Description |
|------|-------------|
| `list_items` | List all items |
| `get_item` | Get item by ID |
| `create_item` | Create new item |
| `update_item` | Update item |
| `delete_item` | Delete item |

## Development

```bash
npm run dev    # Watch mode
npm run build  # Build
npm start      # Run
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `YOUR_API_URL` | API base URL | `http://localhost:3000` |
| `YOUR_API_KEY` | API key | (empty) |
| `LOG_LEVEL` | Log level | `info` |
````

---

## Key Principles

1. **All logs go to stderr** - stdout is for JSON-RPC only
2. **Tools return JSON** - Always stringify results
3. **Auth check before protected operations** - Use the auth-check utility
4. **Descriptive tool descriptions** - Help the AI understand when to use each tool
5. **Input validation** - Check required parameters before calling APIs
6. **Error handling** - Return helpful error messages
7. **Graceful degradation** - When auth fails, guide user to setup

---

## Testing Your MCP Server

1. Build the server: `npm run build`
2. Start Cursor and open a project with the mcp.json configured
3. Ask Claude to use your tools
4. Check stderr logs for debugging

---

## Common Patterns

### Polling for async operations

```typescript
async function waitForCompletion(id: string, timeoutMs: number = 120000): Promise<Result> {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < timeoutMs) {
    const result = await getStatus(id);
    
    if (result.status === "completed") {
      return result;
    }
    
    if (result.status === "failed") {
      throw new Error(result.error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Operation timed out after ${timeoutMs / 1000} seconds`);
}
```

### Template/Caching systems

Store frequently-used configurations to speed up repeated operations.

### Multi-step workflows

Combine multiple API calls into single convenience tools for common use cases.

---

**Good luck building your MCP server!**
