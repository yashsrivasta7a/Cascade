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
    description: `Set up authentication for Flowsmith MCP server. 

The user needs to provide their API key from Flowsmith Settings > API Keys.
If they don't have one, they can create it there.

Use this when authentication fails or when first setting up the MCP server.`,
    inputSchema: {
      type: "object",
      properties: {
        apiKey: {
          type: "string",
          description: "The API key from Flowsmith Settings (starts with 'sk_live_').",
        },
      },
      required: [],
    },
  },
  {
    name: "check_auth",
    description: "Check if the MCP server is authenticated with Flowsmith. Returns the authentication status and user email if authenticated.",
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

const API_BASE = process.env.FLOWSMITH_API_URL || "http://localhost:3000";
const API_KEY = process.env.FLOWSMITH_API_KEY || "";

// Find the MCP config file path
function getMcpConfigPath(): string {
  // Try common locations
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

  // Default to workspace config if nothing found
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

  // Ensure directory exists
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Read existing config or create new
  let config: Record<string, unknown> = {};
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    } catch (e) {
      logger.warn("Could not parse existing config, creating new one");
    }
  }

  // Update the flowsmith server config
  const mcpServers = (config.mcpServers || {}) as Record<string, unknown>;
  const flowsmithConfig = (mcpServers.flowsmith || {}) as Record<string, unknown>;
  const env = (flowsmithConfig.env || {}) as Record<string, string>;

  env.FLOWSMITH_API_KEY = apiKey;
  flowsmithConfig.env = env;

  // Ensure other required fields exist
  if (!flowsmithConfig.command) {
    flowsmithConfig.command = "node";
  }
  if (!flowsmithConfig.args) {
    flowsmithConfig.args = ["mcp/flowsmith/dist/index.js"];
  }
  if (!env.FLOWSMITH_API_URL) {
    env.FLOWSMITH_API_URL = "http://localhost:3000";
  }

  mcpServers.flowsmith = flowsmithConfig;
  config.mcpServers = mcpServers;

  // Write back
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  return { success: true, path: configPath };
}

/**
 * Validate current API key
 */
async function validateApiKey(): Promise<{ valid: boolean; email?: string }> {
  if (!API_KEY) {
    return { valid: false };
  }

  try {
    // Try to list workflows - if it works, the key is valid
    const response = await fetch(`${API_BASE}/api/v1/workflow.list`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      return { valid: true };
    }
    
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

/**
 * Register auth tool handlers
 */
export function registerAuthTools(handlers: Map<string, (args: unknown) => Promise<unknown>>): void {
  // setup_auth - Simple API key setup
  handlers.set("setup_auth", async (args: unknown) => {
    const { apiKey } = (args as SetupAuthArgs) || {};

    // API key provided - save it
    if (apiKey) {
      // Validate API key format
      if (!apiKey.startsWith("sk_live_")) {
        return {
          status: "error",
          message: `Invalid API key format. Keys should start with "sk_live_".`,
          hint: "Go to Flowsmith Settings > API Keys to get or create your key.",
          settingsUrl: `${API_BASE}/settings`,
        };
      }

      try {
        // Update the MCP config file with the provided key
        const configResult = updateMcpConfig(apiKey);

        logger.info(`API key configured`);

        return {
          status: "success",
          message: `API key configured successfully!`,
          configPath: configResult.path,
          apiKeyPrefix: apiKey.substring(0, 12) + "...",
          nextSteps: [
            "Your API key has been saved to the MCP configuration.",
            "Please restart Cursor to apply the changes.",
            "After restarting, you can use all Flowsmith MCP tools!",
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to save API key: ${message}`);
        return {
          status: "error",
          message: `Failed to save API key: ${message}`,
        };
      }
    }

    // No API key provided - tell user where to get it
    const settingsUrl = `${API_BASE}/settings`;
    
    return {
      status: "needs_api_key",
      message: "To use Flowsmith MCP, you need an API key.",
      instructions: [
        `1. Go to Flowsmith Settings: ${settingsUrl}`,
        "2. Navigate to 'API Keys' section",
        "3. Click 'Create API Key' (or copy an existing one)",
        "4. Tell me: 'My API key is sk_live_...'",
      ],
      settingsUrl,
      hint: "Once you have the key, just say 'my API key is sk_live_...'",
    };
  });

  // check_auth - Check current authentication status
  handlers.set("check_auth", async () => {
    logger.debug("Checking authentication status");

    const hasKey = Boolean(API_KEY);
    
    if (!hasKey) {
      return {
        authenticated: false,
        message: "No API key configured. Use the setup_auth tool to authenticate.",
        hint: "Say 'set up flowsmith auth' to get started.",
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
