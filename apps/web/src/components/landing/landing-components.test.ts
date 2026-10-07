import { describe, it, expect, vi } from "vitest";
import {
  ModeExplanationCards,
  MODE_EXPLANATIONS,
} from "./mode-explanation-cards";
import { GUIDE_SLIDES } from "./how-clario-works-modal";

describe("Landing Components Suite", () => {
  describe("MODE_EXPLANATIONS metadata", () => {
    it("defines specifications for all 4 core workspaces", () => {
      const modeIds = MODE_EXPLANATIONS.map((m) => m.id);
      expect(modeIds).toEqual(["personal", "freelancer", "family", "business"]);
    });

    it("includes whatItIs, whoItIsFor, and at least 3 concrete actions per mode", () => {
      for (const mode of MODE_EXPLANATIONS) {
        expect(mode.whatItIs).toBeTruthy();
        expect(mode.whoItIsFor).toBeTruthy();
        expect(mode.whatYouCanDo.length).toBeGreaterThanOrEqual(3);
        expect(mode.primaryHref).toContain(`/?mode=${mode.id}`);
      }
    });

    it("preserves invariants: offchain privacy, nullifiers, and distinct mode roles", () => {
      const personal = MODE_EXPLANATIONS.find((m) => m.id === "personal");
      const business = MODE_EXPLANATIONS.find((m) => m.id === "business");

      expect(personal?.whatYouCanDo.join(" ")).toContain("sub-ledger");
      expect(business?.whatYouCanDo.join(" ")).toContain("nullifier");
    });
  });

  describe("ModeExplanationCards primitive", () => {
    it("instantiates cleanly and renders 4 cards", () => {
      const element = ModeExplanationCards({
        activeModeId: "personal",
        onSelectMode: vi.fn(),
      });
      expect(element).toBeDefined();
      expect(element.props.children).toHaveLength(4);
    });
  });

  describe("GUIDE_SLIDES structure", () => {
    it("provides exactly 5 focused editorial slides", () => {
      expect(GUIDE_SLIDES).toHaveLength(5);
    });

    it("includes sequential step numbers and categories", () => {
      const stepNumbers = GUIDE_SLIDES.map((s) => s.stepNumber);
      expect(stepNumbers).toEqual(["01", "02", "03", "04", "05"]);

      const categories = GUIDE_SLIDES.map((s) => s.category);
      expect(categories).toEqual([
        "DUAL SUB-LEDGER",
        "DEDICATED WORKSPACES",
        "CONFIDENTIAL ENVELOPE",
        "DETERMINISTIC SETTLEMENT",
        "GET STARTED NOW",
      ]);
    });

    it("provides takeaways and executable renderVisual for each slide", () => {
      for (const slide of GUIDE_SLIDES) {
        expect(slide.title).toBeTruthy();
        expect(slide.description).toBeTruthy();
        expect(slide.takeaways.length).toBeGreaterThanOrEqual(3);
        expect(typeof slide.renderVisual).toBe("function");

        // Verify visual returns valid element
        const visual = slide.renderVisual();
        expect(visual).toBeDefined();
      }
    });
  });
});
