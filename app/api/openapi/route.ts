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
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://cascade-ys7.vercel.app";
    
    const openApiDocument = generateOpenApiDocument(appRouter, {
      title: "Cascade API",
      version: "1.0.0",
      description: "Cascade API for managing workflows, executions, and credits.",
      baseUrl: `${baseUrl}/api/v1`,
      docsUrl: "https://docs.cascade.com",
      tags: ["Workflows", "Executions", "Credits"],
    });

    return NextResponse.json(openApiDocument, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[OpenAPI] Error generating spec:", error);
    return NextResponse.json(
      { error: "Failed to generate OpenAPI spec", details: String(error) },
      { status: 500 }
    );
  }
}
