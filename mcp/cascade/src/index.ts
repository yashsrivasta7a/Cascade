#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logger } from "./utils/logger.js";

/**
 * Cascade MCP Server Entry Point
 * 
 * This server provides tools for:
 * - Preset workflows (quick start templates)
 * - Node information (capabilities and schemas)
 * - Workflow builder (AI-driven creation)
 * - Workflow CRUD (manage saved workflows)
 * - Execution (run and monitor workflows)
 */

async function main() {
  logger.info("Starting Cascade MCP Server...");

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info("Cascade MCP Server connected and ready");

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
