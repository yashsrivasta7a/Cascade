import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

describe("<Card />", () => {
  describe("Rendering", () => {
    it("renders children", () => {
      render(<Card>Card Content</Card>);
      expect(screen.getByText("Card Content")).toBeInTheDocument();
    });

    it("renders as a div element", () => {
      const { container } = render(<Card>Test</Card>);
      expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Variants", () => {
    it("applies default variant styles", () => {
      const { container } = render(<Card>Default</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("bg-");
      expect(card.className).toContain("border");
    });

    it("applies elevated variant styles", () => {
      const { container } = render(<Card variant="elevated">Elevated</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("glass-card");
    });

    it("applies glass variant styles", () => {
      const { container } = render(<Card variant="glass">Glass</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("glass");
    });

    it("applies gradient variant styles", () => {
      const { container } = render(<Card variant="gradient">Gradient</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("glass-card");
    });
  });

  describe("Hover Effect", () => {
    it("applies hover styles when hover prop is true", () => {
      const { container } = render(<Card hover>Hoverable</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("hover:");
      expect(card.className).toContain("cursor-pointer");
    });

    it("does not apply hover styles when hover prop is false", () => {
      const { container } = render(<Card hover={false}>Not Hoverable</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain("cursor-pointer");
    });
  });

  describe("Glow Effect", () => {
    it("applies glow styles when glow prop is true", () => {
      const { container } = render(<Card glow>Glowing</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("glow");
    });

    it("does not apply glow styles when glow prop is false", () => {
      const { container } = render(<Card glow={false}>Not Glowing</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).not.toContain("glow-sm");
    });
  });

  describe("Custom ClassName", () => {
    it("merges custom className", () => {
      const { container } = render(<Card className="custom-class">Custom</Card>);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain("custom-class");
      expect(card.className).toContain("rounded-2xl");
    });
  });
});

describe("<CardHeader />", () => {
  it("renders children", () => {
    render(<CardHeader>Header Content</CardHeader>);
    expect(screen.getByText("Header Content")).toBeInTheDocument();
  });

  it("applies default padding styles", () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstChild).toHaveClass("p-6");
  });

  it("merges custom className", () => {
    const { container } = render(<CardHeader className="custom-header">Header</CardHeader>);
    expect(container.firstChild).toHaveClass("custom-header");
  });
});

describe("<CardTitle />", () => {
  it("renders children", () => {
    render(<CardTitle>Title Text</CardTitle>);
    expect(screen.getByText("Title Text")).toBeInTheDocument();
  });

  it("renders as h3 element", () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();
  });

  it("applies text styles", () => {
    const { container } = render(<CardTitle>Title</CardTitle>);
    const title = container.firstChild as HTMLElement;
    expect(title.className).toContain("text-lg");
    expect(title.className).toContain("font-semibold");
  });
});

describe("<CardDescription />", () => {
  it("renders children", () => {
    render(<CardDescription>Description text</CardDescription>);
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });

  it("renders as p element", () => {
    const { container } = render(<CardDescription>Description</CardDescription>);
    expect(container.querySelector("p")).toBeInTheDocument();
  });

  it("applies muted text styles", () => {
    const { container } = render(<CardDescription>Description</CardDescription>);
    const desc = container.firstChild as HTMLElement;
    expect(desc.className).toContain("text-sm");
  });
});

describe("<CardContent />", () => {
  it("renders children", () => {
    render(<CardContent>Content here</CardContent>);
    expect(screen.getByText("Content here")).toBeInTheDocument();
  });

  it("applies default padding styles", () => {
    const { container } = render(<CardContent>Content</CardContent>);
    expect(container.firstChild).toHaveClass("p-6");
  });
});

describe("<CardFooter />", () => {
  it("renders children", () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText("Footer content")).toBeInTheDocument();
  });

  it("applies flex styles for alignment", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveClass("flex");
    expect(container.firstChild).toHaveClass("items-center");
  });

  it("applies gap for spacing children", () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveClass("gap-3");
  });
});

describe("Card Composition", () => {
  it("composes full card with all sub-components", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
          <CardDescription>This is a test card</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content goes here</p>
        </CardContent>
        <CardFooter>
          <button>Action</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText("Test Card")).toBeInTheDocument();
    expect(screen.getByText("This is a test card")).toBeInTheDocument();
    expect(screen.getByText("Main content goes here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });
});
