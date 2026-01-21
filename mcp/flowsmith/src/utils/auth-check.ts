import { logger } from "./logger.js";

// =============================================================================
// AUTHENTICATION CHECK UTILITY
// Centralized auth checking for all MCP tools
// =============================================================================

const API_BASE = process.env.FLOWSMITH_API_URL || "http://localhost:3000";
const API_KEY = process.env.FLOWSMITH_API_KEY || "";

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
      `1. Go to Flowsmith Settings: ${settingsUrl}`,
      "2. Navigate to 'API Keys' section",
      "3. Click 'Create API Key' (or copy an existing one)",
      "4. Tell me: 'My API key is sk_live_...'",
    ],
    settingsUrl,
    hint: "Get your API key from Settings > API Keys, then say 'my API key is sk_live_...'",
  };
}

/**
 * Wrapper to check auth before running a handler
 * Returns auth required response if not authenticated
 */
export function requireAuthForHandler<T>(
  handler: () => Promise<T>
): Promise<T | ReturnType<typeof getAuthRequiredResponse>> {
  if (!isAuthenticated()) {
    logger.warn("Authentication required but no valid API key");
    return Promise.resolve(getAuthRequiredResponse());
  }
  return handler();
}

/**
 * List of tools that DON'T require authentication (read-only, local operations)
 */
export const PUBLIC_TOOLS = new Set([
  // Auth tools
  "setup_auth",
  "check_auth",
  // Read-only preset/node info (local data, no API calls)
  "list_presets",
  "use_preset",
  "list_nodes",
  "get_node_info",
  // Local workflow building (doesn't save)
  "build_workflow",
]);

/**
 * Check if a tool requires authentication
 */
export function toolRequiresAuth(toolName: string): boolean {
  return !PUBLIC_TOOLS.has(toolName);
}
