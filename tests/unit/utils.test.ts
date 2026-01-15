import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("merges tailwind classes with last-win semantics", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("preserves non-conflicting classes", () => {
    expect(cn("p-2", "text-sm")).toContain("p-2");
    expect(cn("p-2", "text-sm")).toContain("text-sm");
  });
});

