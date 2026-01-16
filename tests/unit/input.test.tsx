import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Input } from "@/components/ui/input";

describe("<Input />", () => {
  describe("Rendering", () => {
    it("renders an input element", () => {
      render(<Input />);
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders with placeholder", () => {
      render(<Input placeholder="Enter text..." />);
      expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument();
    });

    it("renders with default value", () => {
      render(<Input defaultValue="default text" />);
      expect(screen.getByDisplayValue("default text")).toBeInTheDocument();
    });

    it("renders with controlled value", () => {
      render(<Input value="controlled" onChange={() => {}} />);
      expect(screen.getByDisplayValue("controlled")).toBeInTheDocument();
    });
  });

  describe("Label", () => {
    it("renders label when provided", () => {
      render(<Input label="Email" />);
      expect(screen.getByText("Email")).toBeInTheDocument();
    });

    it("does not render label when not provided", () => {
      const { container } = render(<Input />);
      expect(container.querySelector("label")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error message when provided", () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("applies error styling to input", () => {
      const { container } = render(<Input error="Error" />);
      const input = container.querySelector("input");
      expect(input?.className).toContain("border-red");
    });

    it("does not show error when not provided", () => {
      const { container } = render(<Input />);
      // Error message p tag should not exist
      const errorP = container.querySelector("p.text-red-400");
      expect(errorP).not.toBeInTheDocument();
    });
  });

  describe("Icons", () => {
    it("renders left icon when provided", () => {
      render(<Input leftIcon={<span data-testid="left-icon">🔍</span>} />);
      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    });

    it("renders right icon when provided", () => {
      render(<Input rightIcon={<span data-testid="right-icon">✓</span>} />);
      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    });

    it("renders both icons simultaneously", () => {
      render(
        <Input
          leftIcon={<span data-testid="left">L</span>}
          rightIcon={<span data-testid="right">R</span>}
        />
      );
      expect(screen.getByTestId("left")).toBeInTheDocument();
      expect(screen.getByTestId("right")).toBeInTheDocument();
    });

    it("applies left padding when left icon is present", () => {
      const { container } = render(
        <Input leftIcon={<span>🔍</span>} />
      );
      const input = container.querySelector("input");
      expect(input?.className).toContain("pl-11");
    });

    it("applies right padding when right icon is present", () => {
      const { container } = render(
        <Input rightIcon={<span>✓</span>} />
      );
      const input = container.querySelector("input");
      expect(input?.className).toContain("pr-11");
    });
  });

  describe("Disabled State", () => {
    it("disables input when disabled prop is true", () => {
      render(<Input disabled />);
      expect(screen.getByRole("textbox")).toBeDisabled();
    });

    it("applies disabled styling", () => {
      const { container } = render(<Input disabled />);
      const input = container.querySelector("input");
      expect(input?.className).toContain("disabled:");
    });
  });

  describe("Types", () => {
    it("renders as text input by default", () => {
      const { container } = render(<Input />);
      const input = container.querySelector("input");
      // Default type is "text" (may be implicit or explicit)
      expect(input?.type || "text").toBe("text");
    });

    it("renders as password input", () => {
      const { container } = render(<Input type="password" />);
      const input = container.querySelector("input");
      expect(input).toHaveAttribute("type", "password");
    });

    it("renders as email input", () => {
      render(<Input type="email" />);
      expect(screen.getByRole("textbox")).toHaveAttribute("type", "email");
    });

    it("renders as number input", () => {
      render(<Input type="number" />);
      expect(screen.getByRole("spinbutton")).toHaveAttribute("type", "number");
    });
  });

  describe("Events", () => {
    it("calls onChange when input value changes", () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "new value" } });
      expect(handleChange).toHaveBeenCalled();
    });

    it("calls onFocus when input is focused", () => {
      const handleFocus = vi.fn();
      render(<Input onFocus={handleFocus} />);
      
      fireEvent.focus(screen.getByRole("textbox"));
      expect(handleFocus).toHaveBeenCalled();
    });

    it("calls onBlur when input loses focus", () => {
      const handleBlur = vi.fn();
      render(<Input onBlur={handleBlur} />);
      
      const input = screen.getByRole("textbox");
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(handleBlur).toHaveBeenCalled();
    });

    it("calls onKeyDown when key is pressed", () => {
      const handleKeyDown = vi.fn();
      render(<Input onKeyDown={handleKeyDown} />);
      
      fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
      expect(handleKeyDown).toHaveBeenCalled();
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to input element", () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
      expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe("Custom ClassName", () => {
    it("merges custom className with default styles", () => {
      const { container } = render(<Input className="custom-input" />);
      const input = container.querySelector("input");
      expect(input?.className).toContain("custom-input");
      expect(input?.className).toContain("rounded-xl");
    });
  });

  describe("Accessibility", () => {
    it("can have aria-label", () => {
      render(<Input aria-label="Search input" />);
      expect(screen.getByLabelText("Search input")).toBeInTheDocument();
    });

    it("can have aria-describedby for error messages", () => {
      render(
        <>
          <Input aria-describedby="error-msg" error="Invalid input" />
          <span id="error-msg">Invalid input</span>
        </>
      );
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-describedby", "error-msg");
    });

    it("can be marked as required", () => {
      render(<Input required />);
      expect(screen.getByRole("textbox")).toBeRequired();
    });
  });

  describe("HTML Attributes", () => {
    it("passes through standard HTML input attributes", () => {
      render(
        <Input
          id="test-input"
          name="test"
          maxLength={100}
          minLength={5}
          autoComplete="off"
        />
      );
      
      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("id", "test-input");
      expect(input).toHaveAttribute("name", "test");
      expect(input).toHaveAttribute("maxLength", "100");
      expect(input).toHaveAttribute("minLength", "5");
      expect(input).toHaveAttribute("autoComplete", "off");
    });

    it("passes through data attributes", () => {
      render(<Input data-testid="custom-input" data-custom="value" />);
      const input = screen.getByTestId("custom-input");
      expect(input).toHaveAttribute("data-custom", "value");
    });
  });
});
