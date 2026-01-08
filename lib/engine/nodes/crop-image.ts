import { z } from "zod";
import { Transloadit } from "transloadit";
import type { NodeExecutor, NodeExecutionContext, NodeExecutionResult } from "../types";
import { AssetRefSchema, ImageOutSchema } from "@/lib/workflow/node-schemas";

// =============================================================================
// CROP IMAGE - Internal Utility Node (via Transloadit)
// =============================================================================

export const CropImageInputSchema = z.object({
  image: AssetRefSchema,
  top: z.number().min(0).max(100).default(0),
  right: z.number().min(0).max(100).default(0),
  bottom: z.number().min(0).max(100).default(0),
  left: z.number().min(0).max(100).default(0),
  context: z.string().optional(),
});

export type CropImageInput = z.infer<typeof CropImageInputSchema>;

export const CropImageOutputSchema = ImageOutSchema;
export type CropImageOutput = z.infer<typeof CropImageOutputSchema>;

function isTransloaditConfigured(): boolean {
  return Boolean(
    process.env.TRANSLOADIT_AUTH_KEY && process.env.TRANSLOADIT_AUTH_SECRET
  );
}

export const cropImageExecutor: NodeExecutor<CropImageInput, CropImageOutput> = {
  type: "crop-image",
  version: "1.0.0",
  inputSchema: CropImageInputSchema,
  outputSchema: CropImageOutputSchema,
  providers: ["internal"],  // Internal processing only
  config: {
    timeout: "2m",
    retryPerProvider: 2,
    maxRetries: 3,
  },

  async execute(
    input: CropImageInput,
    context: NodeExecutionContext
  ): Promise<NodeExecutionResult> {
    if (!isTransloaditConfigured()) {
      return executeMock(input);
    }

    try {
      const transloadit = new Transloadit({
        authKey: process.env.TRANSLOADIT_AUTH_KEY!,
        authSecret: process.env.TRANSLOADIT_AUTH_SECRET!,
      });

      // Calculate crop percentages
      const cropX1 = `${input.left}%`;
      const cropY1 = `${input.top}%`;
      const cropX2 = `${100 - input.right}%`;
      const cropY2 = `${100 - input.bottom}%`;

      const result = await transloadit.createAssembly({
        params: {
          steps: {
            import: {
              robot: "/http/import",
              url: input.image.url,
            },
            crop: {
              robot: "/image/resize",
              use: "import",
              crop: {
                x1: cropX1,
                y1: cropY1,
                x2: cropX2,
                y2: cropY2,
              },
            },
            export: {
              robot: "/s3/store",
              use: "crop",
              // Configure your S3 bucket in Transloadit
            },
          },
        },
        waitForCompletion: true,
      });

      if (result.ok !== "ASSEMBLY_COMPLETED") {
        throw new Error(`Transloadit assembly failed: ${result.error}`);
      }

      const croppedImage = result.results?.crop?.[0];
      if (!croppedImage) {
        throw new Error("No cropped image in result");
      }

      return {
        success: true,
        output: {
          type: "image",
          image: {
            url: croppedImage.ssl_url,
            mimeType: croppedImage.mime,
            width: croppedImage.meta?.width,
            height: croppedImage.meta?.height,
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

function executeMock(input: CropImageInput): NodeExecutionResult {
  // For mock, just return the original image
  return {
    success: true,
    output: {
      type: "image",
      image: {
        url: input.image.url,
        mimeType: input.image.mimeType ?? "image/jpeg",
        width: input.image.width,
        height: input.image.height,
      },
    },
    providerUsed: "mock",
    actualCost: 0,
  };
}

export default cropImageExecutor;

