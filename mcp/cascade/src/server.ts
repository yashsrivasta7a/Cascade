import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { logger } from "./utils/logger.js";
import { toolRequiresAuth, isAuthenticated, getAuthRequiredResponse } from "./utils/auth-check.js";

// Import tool handlers
import { registerPresetTools, presetToolDefinitions } from "./tools/presets.js";
import { registerNodeTools, nodeToolDefinitions } from "./tools/nodes.js";
import { registerBuilderTools, builderToolDefinitions } from "./tools/builder.js";
import { registerWorkflowTools, workflowToolDefinitions } from "./tools/workflows.js";
import { registerExecutionTools, executionToolDefinitions } from "./tools/executions.js";
import { registerAuthTools, authToolDefinitions } from "./tools/auth.js";
import { registerConvenienceTools, convenienceToolDefinitions } from "./tools/convenience.js";
import { registerCreditsTools, creditsToolDefinitions } from "./tools/credits.js";

/**
 * Create and configure the MCP server with all tools
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: "cascade",
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
    ...authToolDefinitions,  // Auth tools first for discoverability
    ...convenienceToolDefinitions, // Quick/convenience tools next
    ...creditsToolDefinitions, // Credits tools
    ...presetToolDefinitions,
    ...nodeToolDefinitions,
    ...builderToolDefinitions,
    ...workflowToolDefinitions,
    ...executionToolDefinitions,
  ];

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools", { count: allToolDefinitions.length });
    return {
      tools: allToolDefinitions,
    };
  });

  // Create tool handlers map
  const toolHandlers = new Map<string, (args: unknown) => Promise<unknown>>();

  // Register all tool handlers
  registerAuthTools(toolHandlers);  // Auth tools first
  registerConvenienceTools(toolHandlers); // Quick/convenience tools
  registerCreditsTools(toolHandlers); // Credits tools
  registerPresetTools(toolHandlers);
  registerNodeTools(toolHandlers);
  registerBuilderTools(toolHandlers);
  registerWorkflowTools(toolHandlers);
  registerExecutionTools(toolHandlers);

  // Register call tool handler
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
