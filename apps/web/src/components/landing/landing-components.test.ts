import { describe, it, expect } from "vitest";
import { WORKSPACES_DATA } from "./workspaces-data";
import { FOLLOW_RECEIPT_STEPS } from "./follow-receipt-rail";
import { GUIDE_SLIDES } from "./how-clario-works-modal";

describe("Landing Components Suite", () => {
  describe("WORKSPACES_DATA typed metadata", () => {
    it("defines specifications for all core workspaces", () => {
      const modeIds = WORKSPACES_DATA.map((m) => m.id);
      expect(modeIds).toEqual([
        "personal",
        "freelancer",
        "family",
        "business",
        "crypto",
      ]);
    });

    it("includes a one-line promise, description, bestFor, and exactly 3 real-life situations per mode", () => {
      for (const mode of WORKSPACES_DATA) {
        expect(mode.name).toBeTruthy();
        expect(mode.promise).toBeTruthy();
        expect(mode.description).toBeTruthy();
        expect(mode.bestFor).toBeTruthy();
        expect(mode.useCases).toHaveLength(3);
        expect(mode.linkText).toContain(mode.name);
        expect(mode.preview.stat1).toBeTruthy();
        expect(mode.preview.stat2).toBeTruthy();
      }
    });

    it("uses plain human situations without whitepaper jargon", () => {
      for (const mode of WORKSPACES_DATA) {
        for (const situation of mode.useCases) {
          expect(situation.toLowerCase()).not.toContain("nullifier");
          expect(situation.toLowerCase()).not.toContain("sub-ledger");
          expect(situation.toLowerCase()).not.toContain("parallel evm");
        }
      }
    });
  });

  describe("FOLLOW_RECEIPT_STEPS story pipeline", () => {
    it("provides exactly 4 plain-language steps", () => {
      expect(FOLLOW_RECEIPT_STEPS).toHaveLength(4);
      expect(FOLLOW_RECEIPT_STEPS.map((s) => s.step)).toEqual([
        "01",
        "02",
        "03",
        "04",
      ]);
    });

    it("matches the 4 founder invariants translated to plain English", () => {
      expect(FOLLOW_RECEIPT_STEPS[0]!.title).toContain("stays on your device");
      expect(FOLLOW_RECEIPT_STEPS[1]!.title).toContain("fingerprint");
      expect(FOLLOW_RECEIPT_STEPS[2]!.title).toContain(
        "AI can suggest, but only people decide",
      );
      expect(FOLLOW_RECEIPT_STEPS[3]!.title).toContain("never be paid twice");
    });

    it("preserves technical details in expandable payload", () => {
      for (const step of FOLLOW_RECEIPT_STEPS) {
        expect(step.technicalDetails.rule).toBeTruthy();
        expect(step.technicalDetails.description).toBeTruthy();
        expect(step.technicalDetails.spec).toBeTruthy();
      }
    });
  });

  describe("GUIDE_SLIDES structure", () => {
    it("provides exactly 5 focused editorial slides", () => {
      expect(GUIDE_SLIDES).toHaveLength(5);
    });

    it("includes sequential step numbers and categories", () => {
      const stepNumbers = GUIDE_SLIDES.map((s) => s.stepNumber);
      expect(stepNumbers).toEqual(["01", "02", "03", "04", "05"]);
    });

    it("provides takeaways and executable renderVisual for each slide", () => {
      for (const slide of GUIDE_SLIDES) {
        expect(slide.title).toBeTruthy();
        expect(slide.description).toBeTruthy();
        expect(slide.takeaways.length).toBeGreaterThanOrEqual(3);
        expect(typeof slide.renderVisual).toBe("function");

        const visual = slide.renderVisual();
        expect(visual).toBeDefined();
      }
    });
  });
});
