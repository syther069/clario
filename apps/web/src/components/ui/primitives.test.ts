import { describe, expect, it } from "vitest";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldLabel,
  Skeleton,
  StatusSentence,
  TextArea,
  TextInput,
} from "./primitives";

describe("Clario UI primitives", () => {
  it("uses native controls with semantic design-system classes", () => {
    expect(Button({ children: "Approve", variant: "primary" }).type).toBe(
      "button",
    );
    expect(
      Button({ children: "Approve", variant: "primary" }).props.className,
    ).toContain("btn-primary");
    expect(
      Badge({ children: "Confirmed", tone: "success" }).props.className,
    ).toContain("badge-success");
    expect(Card({ children: "Record" }).props.className).toBe("card");
    expect(FieldLabel({ children: "Amount" }).props.className).toBe(
      "form-label",
    );
    expect(TextInput({ name: "amount" }).props.className).toBe("form-input");
    expect(TextArea({ name: "purpose" }).props.className).toBe("form-textarea");
  });

  it("prevents repeat actions while a button is loading", () => {
    const button = Button({
      children: "Submit",
      isLoading: true,
      loadingLabel: "Submitting",
    });
    expect(button.props.disabled).toBe(true);
    expect(button.props["aria-busy"]).toBe(true);
    expect(button.props.children).toBe("Submitting");
  });

  it("keeps status, skeleton, and empty states accessible by default", () => {
    expect(StatusSentence({ children: "Manual fallback available" }).type).toBe(
      "p",
    );
    const skeleton = Skeleton({ label: "Loading expense ledger" });
    expect(skeleton.props.role).toBe("status");
    expect(skeleton.props["aria-busy"]).toBe("true");
    expect(skeleton.props["aria-label"]).toBe("Loading expense ledger");

    const empty = EmptyState({ title: "No expenses", children: "Create one." });
    expect(empty.props.className).toContain("empty-state");
    expect(empty.props.children[0].props.children).toBe("No expenses");
  });
});
