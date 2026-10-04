import { describe, it, expect } from "vitest";
import {
  ClarioBadge,
  ClarioCard,
  ClarioMetric,
  ClarioStatus,
  ClarioEmptyState,
} from "./clario-ui";

describe("Clario UI Primitives Suite", () => {
  it("renders ClarioBadge with design-system classes and tone variants", () => {
    const verifiedBadge = ClarioBadge({
      variant: "verified",
      hasDot: true,
      children: "Verified",
    });
    expect(verifiedBadge.props.className).toContain("bg-[#dcfce7]");
    expect(verifiedBadge.props.className).toContain("text-[#15803d]");

    const purpleBadge = ClarioBadge({
      variant: "purple",
      children: "Monad",
    });
    expect(purpleBadge.props.className).toContain("text-[#836EF9]");
  });

  it("renders ClarioCard with Neo-Brutalist border and shadow", () => {
    const card = ClarioCard({
      children: "Card content",
      variant: "default",
    });
    expect(card.props.className).toContain("border-2 border-[#121212]");
    expect(card.props.className).toContain("shadow-[4px_4px_0_0_#121212]");
  });

  it("renders ClarioMetric with label, value, and trend", () => {
    const metric = ClarioMetric({
      label: "Monthly Burn",
      value: "$4,280.00",
      trend: { value: "+12%", isPositive: true },
    });
    expect(metric.props.children).toBeDefined();
  });

  it("renders ClarioStatus verified badge vs local record", () => {
    const verifiedStatus = ClarioStatus({ status: "verified" });
    expect(verifiedStatus.props.className).toContain("bg-[#dcfce7]");

    const localStatus = ClarioStatus({ status: "unverified" });
    expect(localStatus.props.className).toContain("bg-[#f3f4f6]");
  });

  it("renders ClarioEmptyState with 3-question clarity", () => {
    const empty = ClarioEmptyState({
      title: "No Saved Receipts",
      description: "Receipts you anchor to Monad Testnet will appear here.",
      actionText: "Create Receipt",
      onAction: () => {},
    });
    expect(empty.props.className).toContain("border-dashed");
  });
});
