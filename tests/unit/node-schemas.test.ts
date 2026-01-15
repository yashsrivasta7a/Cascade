import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AssetRefSchema,
  NodeInputSchemas,
  NodeOutputSchemas,
} from "@/lib/workflow/node-schemas";

describe("Zod schemas (node-schemas)", () => {
  it("validates AssetRef URLs", () => {
    expect(() =>
      AssetRefSchema.parse({ url: "notaurl" })
    ).toThrowError(z.ZodError);

    expect(
      AssetRefSchema.parse({ url: "https://example.com/file.png" }).url
    ).toBe("https://example.com/file.png");
  });

  it("enforces prompt length limits for seedream input schema", () => {
    const seedream = NodeInputSchemas.seedream;
    const tooLong = "x".repeat(6001);
    expect(() =>
      seedream.parse({ prompt: tooLong, aspectRatio: "1:1" })
    ).toThrowError(z.ZodError);
  });

  it("validates openrouter output shape", () => {
    const openrouterOut = NodeOutputSchemas.openrouter;
    expect(openrouterOut.parse({ type: "text", text: "hello" })).toEqual({
      type: "text",
      text: "hello",
    });
    expect(() => openrouterOut.parse({ type: "text", text: 123 })).toThrowError(
      z.ZodError
    );
  });
});

