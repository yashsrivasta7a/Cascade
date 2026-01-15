import { describe, expect, it } from "vitest";
import {
  parseAndValidateLLMValue,
  parseLLMToType,
  validateProviderConstraints,
} from "@/lib/workflow/llm-type-parser";

describe("parseLLMToType()", () => {
  it("parses numbers from free-form text", () => {
    expect(parseLLMToType("set to 12.5 please", "number", "openrouter", "topP")).toEqual({
      success: true,
      value: 12.5,
    });
  });

  it("parses booleans from common words", () => {
    expect(parseLLMToType("Enabled", "boolean", "openrouter", "promptEnhancer")).toEqual({
      success: true,
      value: true,
    });
    expect(parseLLMToType("no", "boolean", "openrouter", "promptEnhancer")).toEqual({
      success: true,
      value: false,
    });
  });

  it("parses aspect ratio names", () => {
    expect(parseLLMToType("landscape", "aspectRatio", "seedream", "aspectRatio")).toEqual({
      success: true,
      value: "16:9",
    });
  });

  it("rejects empty text", () => {
    expect(parseLLMToType("   ", "text", "openrouter", "prompt")).toEqual({
      success: false,
      error: "Empty text cannot be parsed",
    });
  });

  it("rejects media targets", () => {
    const res = parseLLMToType("hello", "image", "seedream", "image");
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toMatch(/Cannot convert LLM text to media type/);
    }
  });
});

describe("validateProviderConstraints()", () => {
  it("enforces numeric min/max and integer constraints", () => {
    expect(validateProviderConstraints(2.1, "openrouter", "temperature")).toEqual({
      valid: false,
      error: "Value 2.1 exceeds maximum 2",
    });

    expect(validateProviderConstraints(100.1, "openrouter", "maxTokens")).toEqual({
      valid: false,
      error: "Expected an integer, got 100.1",
    });
  });

  it("enforces allowed set constraints", () => {
    expect(validateProviderConstraints("3x", "seedvr", "scale")).toEqual({
      valid: false,
      error: expect.stringMatching(/not allowed/i),
    });
    expect(validateProviderConstraints("4x", "seedvr", "scale")).toEqual({ valid: true });
  });
});

describe("parseAndValidateLLMValue()", () => {
  it("parses and validates in one step", () => {
    expect(parseAndValidateLLMValue("temperature: 0.9", "temperature", "openrouter", "temperature")).toEqual({
      success: true,
      value: 0.9,
    });
  });

  it("fails when value violates provider constraints", () => {
    const res = parseAndValidateLLMValue("temperature 100", "temperature", "openrouter", "temperature");
    expect(res.success).toBe(false);
  });
});

