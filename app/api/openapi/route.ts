import { NextResponse } from "next/server";
import { generateOpenApiDocument } from "trpc-to-openapi";
import { appRouter } from "@/lib/trpc/routers";

// =============================================================================
// OPENAPI SPECIFICATION ENDPOINT
// =============================================================================
// Serves the OpenAPI 3.0 specification document
// Access at: /api/openapi
// Use this with Mintlify, Swagger UI, or any OpenAPI-compatible tool

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://flowsmith-ys7.vercel.app";
  
  const openApiDocument = generateOpenApiDocument(appRouter, {
    title: "Flowsmith API",
    version: "1.0.0",
    description: `
# Flowsmith API

The Flowsmith API allows you to programmatically manage workflows, executions, and credits.

## Authentication

All endpoints require authentication via Bearer token. Include your API key in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Rate Limits

- 100 requests per minute per user
- 1000 requests per hour per user

## Credits

Each workflow execution costs credits based on the nodes used. Check your balance with the \`/credits/balance\` endpoint.
    `.trim(),
    baseUrl: `${baseUrl}/api/v1`,
    docsUrl: "https://docs.flowsmith.com",
    tags: ["Workflows", "Executions", "Credits"],
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter your API key",
      },
    },
  });

  return NextResponse.json(openApiDocument, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}
