import { NextRequest, NextResponse } from "next/server";
import dotenv from "dotenv";
import { fal } from "@fal-ai/client";

dotenv.config({ path: ".env.local" });

// Configure fal.ai
if (process.env.FAL_KEY) {
  fal.config({ credentials: process.env.FAL_KEY });
}

// =============================================================================
// SEEDREAM 4.5 IMAGE GENERATION / EDITING API
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      prompt?: string;
      negativePrompt?: string;
      aspectRatio?: string;
      image?: string; // Base64 or URL for image editing
      seed?: number;
    };

    const { prompt, negativePrompt, aspectRatio, image, seed } = body;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!process.env.FAL_KEY) {
      // Return mock response if no API key
      return NextResponse.json({
        status: "success",
        mode: "mock",
        output: {
          type: "image",
          image: {
            url: `https://placehold.co/512x512/1a1a2e/ffffff?text=${encodeURIComponent(prompt.slice(0, 20))}`,
            width: 512,
            height: 512,
          },
        },
        message: "Mock response - Set FAL_KEY for real generation",
      });
    }

    console.log(`[Seedream] Generating image: "${prompt.slice(0, 50)}..."`);

    // Determine if this is generation or editing
    const isEditing = Boolean(image);
    
    // Build input for fal.ai
    const input: Record<string, unknown> = {
      prompt,
      negative_prompt: negativePrompt || "",
      image_size: aspectRatioToSize(aspectRatio || "1:1"),
      num_images: 1,
      enable_safety_checker: true,
    };

    if (seed !== undefined) {
      input.seed = seed;
    }

    if (isEditing && image) {
      input.image_url = image;
      input.strength = 0.75; // How much to change the image
    }

    // Call fal.ai Seedream
    const result = await fal.subscribe("fal-ai/seedream-4.5", {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`[Seedream] Progress: ${update.logs?.map(l => l.message).join(", ")}`);
        }
      },
    });

    console.log(`[Seedream] Generation complete`);

    // Extract the image URL from result
    const images = (result.data as { images?: Array<{ url: string; width: number; height: number }> })?.images;
    
    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No image generated" },
        { status: 500 }
      );
    }

    const generatedImage = images[0];

    return NextResponse.json({
      status: "success",
      mode: isEditing ? "edit" : "generate",
      output: {
        type: "image",
        image: {
          url: generatedImage.url,
          width: generatedImage.width,
          height: generatedImage.height,
        },
      },
      requestId: (result as { requestId?: string }).requestId,
    });
  } catch (error) {
    console.error("[Seedream] Error:", error);
    return NextResponse.json(
      { 
        status: "error",
        error: error instanceof Error ? error.message : String(error) 
      },
      { status: 500 }
    );
  }
}

function aspectRatioToSize(ratio: string): { width: number; height: number } {
  const sizes: Record<string, { width: number; height: number }> = {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1344, height: 768 },
    "9:16": { width: 768, height: 1344 },
    "4:3": { width: 1152, height: 896 },
    "3:4": { width: 896, height: 1152 },
  };
  return sizes[ratio] || sizes["1:1"];
}

export async function GET() {
  return NextResponse.json({
    message: "Seedream 4.5 Image Generation API",
    usage: {
      method: "POST",
      body: {
        prompt: "string (required) - Description of the image",
        negativePrompt: "string (optional) - What to avoid",
        aspectRatio: "1:1 | 16:9 | 9:16 | 4:3 | 3:4",
        image: "string (optional) - Base64 or URL for image editing",
        seed: "number (optional) - For reproducibility",
      }
    },
    configured: Boolean(process.env.FAL_KEY),
  });
}

