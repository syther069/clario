import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  motionTokens,
  spacingTokens,
  themeTokens,
} from "./design-tokens";

describe("Clario design tokens", () => {
  it("keeps documented semantic foreground pairs above WCAG AA contrast", () => {
    const pairs = [
      [
        "light text primary",
        themeTokens.light.textPrimary,
        themeTokens.light.surfaceCard,
      ],
      [
        "light text muted",
        themeTokens.light.textMuted,
        themeTokens.light.surfaceCard,
      ],
      [
        "light accent",
        themeTokens.light.accentPrimary,
        themeTokens.light.surfaceCard,
      ],
      [
        "light success",
        themeTokens.light.success,
        themeTokens.light.successSoft,
      ],
      [
        "light warning",
        themeTokens.light.warning,
        themeTokens.light.warningSoft,
      ],
      ["light danger", themeTokens.light.danger, themeTokens.light.dangerSoft],
      ["light info", themeTokens.light.info, themeTokens.light.infoSoft],
      [
        "light ai suggested",
        themeTokens.light.aiSuggested,
        themeTokens.light.aiSuggestedSoft,
      ],
      [
        "dark text primary",
        themeTokens.dark.textPrimary,
        themeTokens.dark.surfaceCard,
      ],
      [
        "dark text muted",
        themeTokens.dark.textMuted,
        themeTokens.dark.surfaceCard,
      ],
      [
        "dark accent",
        themeTokens.dark.accentPrimary,
        themeTokens.dark.surfaceCard,
      ],
      ["dark success", themeTokens.dark.success, themeTokens.dark.successSoft],
      ["dark warning", themeTokens.dark.warning, themeTokens.dark.warningSoft],
      ["dark danger", themeTokens.dark.danger, themeTokens.dark.dangerSoft],
      ["dark info", themeTokens.dark.info, themeTokens.dark.infoSoft],
      [
        "dark ai suggested",
        themeTokens.dark.aiSuggested,
        themeTokens.dark.aiSuggestedSoft,
      ],
    ] as const;

    for (const [name, foreground, background] of pairs) {
      expect(
        contrastRatio(foreground, background),
        name,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps disabled text above the internal 3:1 product target", () => {
    expect(
      contrastRatio(
        themeTokens.light.textDisabled,
        themeTokens.light.surfaceDisabled,
      ),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrastRatio(
        themeTokens.dark.textDisabled,
        themeTokens.dark.surfaceDisabled,
      ),
    ).toBeGreaterThanOrEqual(3);
  });

  it("exposes the required spacing and motion scales", () => {
    expect(Object.values(spacingTokens)).toEqual([
      "0.25rem",
      "0.5rem",
      "0.75rem",
      "1rem",
      "1.25rem",
      "1.5rem",
      "2rem",
      "2.5rem",
      "3rem",
      "4rem",
    ]);
    expect(motionTokens.durationFast).toBe("120ms");
    expect(motionTokens.durationMedium).toBe("220ms");
    expect(motionTokens.durationSlow).toBe("360ms");
  });
});
