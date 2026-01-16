import { describe, expect, it } from "vitest";
import {
  CREDITS_PER_DOLLAR,
  calculateSeedvrCost,
  calculateSeedanceCost,
  calculateElevenlabsCost,
  calculateLipsyncCost,
  calculateOpenrouterCost,
  estimateNodeCost,
  getNodeCost,
  calculateWorkflowCost,
  hasEnoughCredits,
  formatCredits,
  creditsToDollars,
  dollarsToCredits,
  NODE_CREDIT_COSTS,
} from "@/lib/credits";

describe("Credits System", () => {
  describe("Constants", () => {
    it("has correct conversion rate", () => {
      expect(CREDITS_PER_DOLLAR).toBe(1_000_000);
    });

    it("has defined costs for all node types", () => {
      expect(NODE_CREDIT_COSTS.seedream).toBe(40_000);
      expect(NODE_CREDIT_COSTS.seedvr).toBe(2_000);
      expect(NODE_CREDIT_COSTS.seedance).toBe(260_000);
      expect(NODE_CREDIT_COSTS.elevenlabs).toBe(50_000);
      expect(NODE_CREDIT_COSTS.openrouter).toBe(50_000);
      expect(NODE_CREDIT_COSTS.lipsync).toBe(350_000);
      expect(NODE_CREDIT_COSTS["crop-image"]).toBe(1_000);
    });
  });

  describe("calculateSeedvrCost()", () => {
    it("calculates cost based on megapixels", () => {
      // 1 megapixel = 1000 credits
      expect(calculateSeedvrCost(1000, 1000)).toBe(1_000);
    });

    it("handles 4K resolution", () => {
      // 4K = 3840 x 2160 = ~8.3 megapixels
      const cost = calculateSeedvrCost(3840, 2160);
      expect(cost).toBeGreaterThan(8000);
      expect(cost).toBeLessThan(9000);
    });

    it("handles small images", () => {
      // 512 x 512 = ~0.26 megapixels
      const cost = calculateSeedvrCost(512, 512);
      expect(cost).toBeLessThan(1000);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe("calculateSeedanceCost()", () => {
    it("calculates higher cost with audio", () => {
      const withAudio = calculateSeedanceCost(1280, 720, 24, 5, true);
      const withoutAudio = calculateSeedanceCost(1280, 720, 24, 5, false);
      expect(withAudio).toBe(withoutAudio * 2);
    });

    it("increases with duration", () => {
      const short = calculateSeedanceCost(1280, 720, 24, 4, true);
      const long = calculateSeedanceCost(1280, 720, 24, 8, true);
      expect(long).toBe(short * 2);
    });

    it("increases with resolution", () => {
      const sd = calculateSeedanceCost(640, 360, 24, 5, true);
      const hd = calculateSeedanceCost(1280, 720, 24, 5, true);
      expect(hd).toBe(sd * 4); // 4x the pixels
    });
  });

  describe("calculateElevenlabsCost()", () => {
    it("calculates 100 credits per character", () => {
      expect(calculateElevenlabsCost(1)).toBe(100);
      expect(calculateElevenlabsCost(10)).toBe(1000);
      expect(calculateElevenlabsCost(1000)).toBe(100_000);
    });

    it("handles empty text", () => {
      expect(calculateElevenlabsCost(0)).toBe(0);
    });
  });

  describe("calculateLipsyncCost()", () => {
    it("calculates $0.70 per minute", () => {
      // 60 seconds = $0.70 = 700,000 credits
      expect(calculateLipsyncCost(60)).toBe(700_000);
    });

    it("handles fractional minutes", () => {
      // 30 seconds = $0.35 = 350,000 credits
      expect(calculateLipsyncCost(30)).toBe(350_000);
    });
  });

  describe("calculateOpenrouterCost()", () => {
    it("returns minimum cost for zero tokens", () => {
      expect(calculateOpenrouterCost(0, 0)).toBe(100);
    });

    it("charges more for output tokens than input", () => {
      const inputOnlyCost = calculateOpenrouterCost(1000, 0);
      const outputOnlyCost = calculateOpenrouterCost(0, 1000);
      expect(outputOnlyCost).toBeGreaterThan(inputOnlyCost);
    });

    it("uses model-specific pricing for GPT-4o-mini", () => {
      const defaultCost = calculateOpenrouterCost(1000, 1000);
      const gptCost = calculateOpenrouterCost(1000, 1000, "openai/gpt-4o-mini");
      expect(gptCost).toBe(defaultCost); // Same as default
    });

    it("uses higher pricing for Claude Sonnet 4", () => {
      const gptCost = calculateOpenrouterCost(1000, 1000, "openai/gpt-4o-mini");
      const claudeCost = calculateOpenrouterCost(1000, 1000, "anthropic/claude-sonnet-4");
      expect(claudeCost).toBeGreaterThan(gptCost);
    });
  });

  describe("estimateNodeCost()", () => {
    it("returns base cost when no input provided", () => {
      expect(estimateNodeCost("seedream")).toBe(40_000);
      expect(estimateNodeCost("openrouter")).toBe(50_000);
    });

    it("calculates dynamic cost for seedvr with dimensions", () => {
      const cost = estimateNodeCost("seedvr", { width: 2048, height: 2048 });
      expect(cost).toBeGreaterThan(NODE_CREDIT_COSTS.seedvr);
    });

    it("calculates dynamic cost for elevenlabs with text", () => {
      const cost = estimateNodeCost("elevenlabs", { text: "Hello world" });
      expect(cost).toBe(calculateElevenlabsCost(11)); // 11 characters
    });

    it("returns base cost for unknown node types", () => {
      expect(estimateNodeCost("unknown-node")).toBe(0);
    });

    it("handles invalid input gracefully", () => {
      // Should not throw, should return base cost
      const cost = estimateNodeCost("seedvr", { width: "not a number", height: null });
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe("getNodeCost()", () => {
    it("returns cost for known node types", () => {
      expect(getNodeCost("seedream")).toBe(40_000);
      expect(getNodeCost("lipsync")).toBe(350_000);
    });

    it("returns 0 for unknown node types", () => {
      expect(getNodeCost("nonexistent")).toBe(0);
    });
  });

  describe("calculateWorkflowCost()", () => {
    it("sums costs of all nodes", () => {
      const nodes = ["seedream", "openrouter", "elevenlabs"];
      const expected = 40_000 + 50_000 + 50_000;
      expect(calculateWorkflowCost(nodes)).toBe(expected);
    });

    it("returns 0 for empty workflow", () => {
      expect(calculateWorkflowCost([])).toBe(0);
    });
  });

  describe("hasEnoughCredits()", () => {
    it("returns true when balance exceeds cost", () => {
      expect(hasEnoughCredits(100_000, 50_000)).toBe(true);
    });

    it("returns true when balance equals cost", () => {
      expect(hasEnoughCredits(50_000, 50_000)).toBe(true);
    });

    it("returns false when balance is below cost", () => {
      expect(hasEnoughCredits(30_000, 50_000)).toBe(false);
    });
  });

  describe("formatCredits()", () => {
    it("formats zero", () => {
      expect(formatCredits(0)).toBe("0");
    });

    it("formats small numbers with commas", () => {
      expect(formatCredits(500)).toBe("500");
    });

    it("formats thousands as K", () => {
      expect(formatCredits(5_000)).toBe("5K");
      expect(formatCredits(15_000)).toBe("15K");
    });

    it("formats millions as M", () => {
      expect(formatCredits(1_000_000)).toBe("1.00M");
      expect(formatCredits(2_500_000)).toBe("2.50M");
      expect(formatCredits(10_500_000)).toBe("10.5M");
    });
  });

  describe("creditsToDollars()", () => {
    it("converts credits to dollar string", () => {
      expect(creditsToDollars(1_000_000)).toBe("$1.00");
      expect(creditsToDollars(500_000)).toBe("$0.50");
    });

    it("shows <$0.01 for tiny amounts", () => {
      expect(creditsToDollars(100)).toBe("<$0.01");
    });
  });

  describe("dollarsToCredits()", () => {
    it("converts dollars to credits", () => {
      expect(dollarsToCredits(1)).toBe(1_000_000);
      expect(dollarsToCredits(0.50)).toBe(500_000);
    });

    it("rounds to nearest integer", () => {
      expect(dollarsToCredits(0.001)).toBe(1_000);
    });
  });
});
