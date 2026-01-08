import { z } from "zod";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, ImageOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// CROP IMAGE - Internal Utility Node (via sharp)
// =============================================================================

export const CropImageInputSchema = z.object({
  image: AssetRefSchema,
  // Percentage-based crop (0-100)
  xPercent: z.number().min(0).max(100).default(0),
  yPercent: z.number().min(0).max(100).default(0),
  widthPercent: z.number().min(1).max(100).default(100),
  heightPercent: z.number().min(1).max(100).default(100),
  context: z.string().optional(),
});

export type CropImageInput = z.infer<typeof CropImageInputSchema>;

export const CropImageOutputSchema = ImageOutSchema;
export type CropImageOutput = z.infer<typeof CropImageOutputSchema>;

export const cropImageExecutor: NodeExecutor<CropImageInput, CropImageOutput> = {
  type: "crop-image",
  version: "1.0.0",
  inputSchema: CropImageInputSchema,
  outputSchema: CropImageOutputSchema,
  providers: ["internal"], // Uses sharp internally
  config: {
    timeout: "2m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: CropImageInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    try {
      // Dynamic import to avoid bundling sharp in client
      const sharp = (await import("sharp")).default;

      let imageBuffer: Buffer;
      
      // Handle base64 data URLs
      if (input.image.url.startsWith("data:")) {
        const base64Data = input.image.url.split(",")[1];
        if (!base64Data) {
          throw new Error("Invalid data URL format");
        }
        imageBuffer = Buffer.from(base64Data, "base64");
      } else {
        // Fetch remote URL
        const response = await fetch(input.image.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        imageBuffer = Buffer.from(await response.arrayBuffer());
      }

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      if (width === 0 || height === 0) {
        throw new Error("Could not determine image dimensions");
      }

      // Calculate crop region from percentages
      const left = Math.round((input.xPercent / 100) * width);
      const top = Math.round((input.yPercent / 100) * height);
      const cropWidth = Math.round((input.widthPercent / 100) * width);
      const cropHeight = Math.round((input.heightPercent / 100) * height);

      // Ensure we don't exceed image bounds
      const safeWidth = Math.min(cropWidth, width - left);
      const safeHeight = Math.min(cropHeight, height - top);

      if (safeWidth <= 0 || safeHeight <= 0) {
        throw new Error("Invalid crop dimensions");
      }

      // Perform the crop
      const croppedBuffer = await sharp(imageBuffer)
        .extract({
          left,
          top,
          width: safeWidth,
          height: safeHeight,
        })
        .toBuffer();

      // Convert to base64 data URL for immediate use
      const mimeType = metadata.format === "png" ? "image/png" : "image/jpeg";
      const base64 = croppedBuffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64}`;

      return {
        success: true,
        output: {
          type: "image",
          image: {
            url: dataUrl,
            mimeType,
            width: safeWidth,
            height: safeHeight,
          },
        },
        providerUsed: "internal",
        actualCost: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerUsed: "internal",
      };
    }
  },
};

export default cropImageExecutor;
