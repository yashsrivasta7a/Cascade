import { describe, expect, it } from "vitest";
import {
  isTypeCompatible,
  validateConnection,
  isSettingsHandle,
  isMediaHandle,
  getHandleDataType,
  getSettingForHandle,
  TYPE_COMPATIBILITY_GROUPS,
  dataTypeColors,
  dataTypeCategory,
} from "@/types/nodes";

describe("Type Compatibility System", () => {
  describe("isTypeCompatible()", () => {
    describe("same type connections", () => {
      it("allows connecting same types", () => {
        expect(isTypeCompatible("image", "image")).toBe(true);
        expect(isTypeCompatible("video", "video")).toBe(true);
        expect(isTypeCompatible("audio", "audio")).toBe(true);
        expect(isTypeCompatible("text", "text")).toBe(true);
        expect(isTypeCompatible("number", "number")).toBe(true);
      });
    });

    describe("any type connections", () => {
      it("any source connects to any target", () => {
        expect(isTypeCompatible("any", "image")).toBe(true);
        expect(isTypeCompatible("any", "video")).toBe(true);
        expect(isTypeCompatible("any", "text")).toBe(true);
        expect(isTypeCompatible("any", "number")).toBe(true);
      });

      it("any target accepts any source", () => {
        expect(isTypeCompatible("image", "any")).toBe(true);
        expect(isTypeCompatible("video", "any")).toBe(true);
        expect(isTypeCompatible("text", "any")).toBe(true);
        expect(isTypeCompatible("number", "any")).toBe(true);
      });
    });

    describe("number type group", () => {
      it("number connects to seed", () => {
        expect(isTypeCompatible("number", "seed")).toBe(true);
        expect(isTypeCompatible("seed", "number")).toBe(true);
      });

      it("number connects to duration", () => {
        expect(isTypeCompatible("number", "duration")).toBe(true);
        expect(isTypeCompatible("duration", "number")).toBe(true);
      });

      it("number connects to temperature", () => {
        expect(isTypeCompatible("number", "temperature")).toBe(true);
        expect(isTypeCompatible("temperature", "number")).toBe(true);
      });

      it("seed connects to temperature", () => {
        expect(isTypeCompatible("seed", "temperature")).toBe(true);
        expect(isTypeCompatible("temperature", "seed")).toBe(true);
      });
    });

    describe("text type group", () => {
      it("text connects to prompt", () => {
        expect(isTypeCompatible("text", "prompt")).toBe(true);
        expect(isTypeCompatible("prompt", "text")).toBe(true);
      });

      it("text connects to negative", () => {
        expect(isTypeCompatible("text", "negative")).toBe(true);
        expect(isTypeCompatible("negative", "text")).toBe(true);
      });

      it("prompt connects to negative", () => {
        expect(isTypeCompatible("prompt", "negative")).toBe(true);
        expect(isTypeCompatible("negative", "prompt")).toBe(true);
      });
    });

    describe("strict types (no cross-connection)", () => {
      it("image does not connect to video", () => {
        expect(isTypeCompatible("image", "video")).toBe(false);
        expect(isTypeCompatible("video", "image")).toBe(false);
      });

      it("audio does not connect to video", () => {
        expect(isTypeCompatible("audio", "video")).toBe(false);
        expect(isTypeCompatible("video", "audio")).toBe(false);
      });

      it("boolean does not connect to number", () => {
        expect(isTypeCompatible("boolean", "number")).toBe(false);
        expect(isTypeCompatible("number", "boolean")).toBe(false);
      });

      it("aspectRatio does not connect to text", () => {
        expect(isTypeCompatible("aspectRatio", "text")).toBe(false);
        expect(isTypeCompatible("text", "aspectRatio")).toBe(false);
      });

      it("model only connects to model", () => {
        expect(isTypeCompatible("model", "text")).toBe(false);
        expect(isTypeCompatible("model", "prompt")).toBe(false);
        expect(isTypeCompatible("model", "model")).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("handles undefined types", () => {
        expect(isTypeCompatible(undefined, "text")).toBe(false);
        expect(isTypeCompatible("text", undefined)).toBe(false);
        expect(isTypeCompatible(undefined, undefined)).toBe(false);
      });

      it("handles unknown type strings", () => {
        expect(isTypeCompatible("unknown" as any, "text")).toBe(false);
      });
    });
  });

  describe("validateConnection()", () => {
    it("returns valid for compatible types", () => {
      const result = validateConnection("image", "image");
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("returns invalid with reason for incompatible types", () => {
      const result = validateConnection("image", "video");
      expect(result.valid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain("Cannot connect");
    });

    it("handles any type", () => {
      expect(validateConnection("any", "image").valid).toBe(true);
      expect(validateConnection("image", "any").valid).toBe(true);
    });

    it("handles undefined types", () => {
      const result = validateConnection(undefined, "text");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Missing type");
    });
  });

  describe("isSettingsHandle()", () => {
    it("identifies prompt as settings handle for openrouter", () => {
      expect(isSettingsHandle("openrouter", "prompt")).toBe(true);
    });

    it("identifies temperature as settings handle", () => {
      expect(isSettingsHandle("openrouter", "temperature")).toBe(true);
    });

    it("returns false for media handles", () => {
      expect(isSettingsHandle("seedream", "image")).toBe(false);
    });

    it("returns false for unknown node types", () => {
      expect(isSettingsHandle("unknown" as any, "prompt")).toBe(false);
    });
  });

  describe("isMediaHandle()", () => {
    it("identifies image input as media handle", () => {
      expect(isMediaHandle("seedvr", "image")).toBe(true);
    });

    it("returns false for settings handles", () => {
      expect(isMediaHandle("openrouter", "temperature")).toBe(false);
    });

    it("returns false for unknown node types", () => {
      expect(isMediaHandle("unknown" as any, "image")).toBe(false);
    });
  });

  describe("getHandleDataType()", () => {
    it("returns image type for seedream output", () => {
      const type = getHandleDataType("seedream", "outputs", "image");
      expect(type).toBe("image");
    });

    it("returns text type for openrouter output", () => {
      const type = getHandleDataType("openrouter", "outputs", "text");
      expect(type).toBe("text");
    });

    it("returns undefined for unknown handle", () => {
      const type = getHandleDataType("seedream", "inputs", "nonexistent");
      expect(type).toBeUndefined();
    });

    it("returns undefined for undefined node type", () => {
      const type = getHandleDataType(undefined, "outputs", "image");
      expect(type).toBeUndefined();
    });
  });

  describe("getSettingForHandle()", () => {
    it("returns setting value when present", () => {
      const data = { temperature: 0.7, prompt: "test" };
      const value = getSettingForHandle("openrouter", data, "temperature");
      expect(value).toBe(0.7);
    });

    it("returns undefined for non-setting handles", () => {
      const data = { image: "url" };
      const value = getSettingForHandle("seedream", data, "image");
      // image is a media input, not a setting
      expect(value).toBeUndefined();
    });

    it("returns undefined for unknown node types", () => {
      const value = getSettingForHandle("unknown" as any, {}, "prompt");
      expect(value).toBeUndefined();
    });
  });

  describe("dataTypeColors", () => {
    it("has colors defined for all data types", () => {
      const expectedTypes = [
        "text", "image", "video", "audio", "any",
        "prompt", "negative", "seed", "aspectRatio",
        "duration", "model", "temperature", "number", "boolean"
      ];
      
      for (const type of expectedTypes) {
        expect(dataTypeColors[type as keyof typeof dataTypeColors]).toBeDefined();
        expect(dataTypeColors[type as keyof typeof dataTypeColors].solid).toBeTruthy();
      }
    });

    it("has valid hex colors for solid property", () => {
      for (const [type, colors] of Object.entries(dataTypeColors)) {
        expect(colors.solid).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });

  describe("dataTypeCategory", () => {
    it("categorizes media types correctly", () => {
      expect(dataTypeCategory.text).toBe("media");
      expect(dataTypeCategory.image).toBe("media");
      expect(dataTypeCategory.video).toBe("media");
      expect(dataTypeCategory.audio).toBe("media");
      expect(dataTypeCategory.any).toBe("media");
    });

    it("categorizes settings types correctly", () => {
      expect(dataTypeCategory.prompt).toBe("settings");
      expect(dataTypeCategory.negative).toBe("settings");
      expect(dataTypeCategory.seed).toBe("settings");
      expect(dataTypeCategory.temperature).toBe("settings");
      expect(dataTypeCategory.number).toBe("settings");
      expect(dataTypeCategory.boolean).toBe("settings");
    });
  });

  describe("TYPE_COMPATIBILITY_GROUPS", () => {
    it("number group includes related types", () => {
      expect(TYPE_COMPATIBILITY_GROUPS.number).toContain("seed");
      expect(TYPE_COMPATIBILITY_GROUPS.number).toContain("duration");
      expect(TYPE_COMPATIBILITY_GROUPS.number).toContain("temperature");
    });

    it("text group includes related types", () => {
      expect(TYPE_COMPATIBILITY_GROUPS.text).toContain("prompt");
      expect(TYPE_COMPATIBILITY_GROUPS.text).toContain("negative");
    });

    it("strict types have only themselves", () => {
      expect(TYPE_COMPATIBILITY_GROUPS.boolean).toEqual(["boolean"]);
      expect(TYPE_COMPATIBILITY_GROUPS.aspectRatio).toEqual(["aspectRatio"]);
    });
  });
});
