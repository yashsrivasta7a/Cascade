import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/ui/button";

describe("<Button />", () => {
  describe("Rendering", () => {
    it("renders children text", () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText("Click me")).toBeInTheDocument();
    });

    it("renders as a button element", () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders with left icon", () => {
      render(
        <Button leftIcon={<span data-testid="left-icon">→</span>}>
          With Icon
        </Button>
      );
      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    });

    it("renders with right icon", () => {
      render(
        <Button rightIcon={<span data-testid="right-icon">←</span>}>
          With Icon
        </Button>
      );
      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("applies primary variant styles by default", () => {
      const { container } = render(<Button>Primary</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/bg-gradient-to-r/);
    });

    it("applies secondary variant styles", () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/bg-zinc-800/);
    });

    it("applies ghost variant styles", () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/bg-transparent/);
    });

    it("applies outline variant styles", () => {
      const { container } = render(<Button variant="outline">Outline</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/border/);
    });

    it("applies danger variant styles", () => {
      const { container } = render(<Button variant="danger">Danger</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/red/);
    });

    it("applies gradient variant styles", () => {
      const { container } = render(<Button variant="gradient">Gradient</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/violet/);
    });
  });

  describe("Sizes", () => {
    it("applies small size styles", () => {
      const { container } = render(<Button size="sm">Small</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/h-8/);
    });

    it("applies medium size styles by default", () => {
      const { container } = render(<Button>Medium</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/h-10/);
    });

    it("applies large size styles", () => {
      const { container } = render(<Button size="lg">Large</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/h-12/);
    });

    it("applies icon size styles", () => {
      const { container } = render(<Button size="icon">🔔</Button>);
      const button = container.querySelector("button");
      expect(button?.className).toMatch(/w-10/);
    });
  });

  describe("States", () => {
    it("shows loading spinner when isLoading is true", () => {
      const { container } = render(<Button isLoading>Loading</Button>);
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // SVG className is an SVGAnimatedString, access baseVal for string comparison
      expect(svg?.getAttribute("class")).toMatch(/animate-spin/);
    });

    it("disables button when isLoading is true", () => {
      render(<Button isLoading>Loading</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("disables button when disabled prop is true", () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("hides right icon when loading", () => {
      render(
        <Button isLoading rightIcon={<span data-testid="right-icon">→</span>}>
          Loading
        </Button>
      );
      expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
    });
  });

  describe("Interactions", () => {
    it("calls onClick when clicked", () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);
      
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("does not call onClick when loading", () => {
      const handleClick = vi.fn();
      render(<Button isLoading onClick={handleClick}>Loading</Button>);
      
      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe("Custom className", () => {
    it("merges custom className with default styles", () => {
      const { container } = render(
        <Button className="custom-class">Custom</Button>
      );
      const button = container.querySelector("button");
      expect(button?.className).toContain("custom-class");
    });
  });
});
