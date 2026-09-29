export type ThemeName = "light" | "dark";

export interface ThemeTokens {
  backgroundPrimary: string;
  backgroundSecondary: string;
  backgroundElevated: string;
  surfaceCard: string;
  surfaceCardHover: string;
  surfaceDisabled: string;
  surfaceSelected: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  accentPrimary: string;
  accentPrimaryHover: string;
  accentPrimaryStrong: string;
  textOnAccent: string;
  accentSecondary: string;
  accentSoft: string;
  successSoft: string;
  success: string;
  warningSoft: string;
  warning: string;
  dangerSoft: string;
  danger: string;
  infoSoft: string;
  info: string;
  aiSuggestedSoft: string;
  aiSuggested: string;
  link: string;
  focus: string;
}

export const themeTokens: Record<ThemeName, ThemeTokens> = {
  light: {
    backgroundPrimary: "#f4f6f8",
    backgroundSecondary: "#eef1f4",
    backgroundElevated: "#ffffff",
    surfaceCard: "#ffffff",
    surfaceCardHover: "#f0f3f7",
    surfaceDisabled: "#e8ecf1",
    surfaceSelected: "#e8eeff",
    borderSubtle: "#d7dde5",
    borderStrong: "#a9b3c0",
    textPrimary: "#101318",
    textSecondary: "#46515f",
    textMuted: "#667180",
    textDisabled: "#77818e",
    accentPrimary: "#2457f5",
    accentPrimaryHover: "#1947d8",
    accentPrimaryStrong: "#1036a9",
    textOnAccent: "#ffffff",
    accentSecondary: "#6758b8",
    accentSoft: "#e8eeff",
    successSoft: "#e1f4ec",
    success: "#087a55",
    warningSoft: "#fff0d6",
    warning: "#8a5100",
    dangerSoft: "#fbe8ea",
    danger: "#ad2632",
    infoSoft: "#e4f1fb",
    info: "#1b63a8",
    aiSuggestedSoft: "#f0edf8",
    aiSuggested: "#625887",
    link: "#1746d1",
    focus: "#1746d1",
  },
  dark: {
    backgroundPrimary: "#0b0d10",
    backgroundSecondary: "#0f1216",
    backgroundElevated: "#181c22",
    surfaceCard: "#12151a",
    surfaceCardHover: "#191e24",
    surfaceDisabled: "#20242a",
    surfaceSelected: "#17234a",
    borderSubtle: "#2b313a",
    borderStrong: "#566170",
    textPrimary: "#f5f7fa",
    textSecondary: "#c7cdd6",
    textMuted: "#a8b0bc",
    textDisabled: "#7e8793",
    accentPrimary: "#86a3ff",
    accentPrimaryHover: "#a2b7ff",
    accentPrimaryStrong: "#c7d4ff",
    textOnAccent: "#101318",
    accentSecondary: "#b7a8f3",
    accentSoft: "#17234a",
    successSoft: "#12392e",
    success: "#56d6a3",
    warningSoft: "#3b2b13",
    warning: "#f2b84b",
    dangerSoft: "#421d23",
    danger: "#ff8791",
    infoSoft: "#153047",
    info: "#72b7f2",
    aiSuggestedSoft: "#2b273c",
    aiSuggested: "#c0b5ea",
    link: "#9ab2ff",
    focus: "#a9bdff",
  },
};

export const spacingTokens = {
  space1: "0.25rem",
  space2: "0.5rem",
  space3: "0.75rem",
  space4: "1rem",
  space5: "1.25rem",
  space6: "1.5rem",
  space8: "2rem",
  space10: "2.5rem",
  space12: "3rem",
  space16: "4rem",
} as const;

export const motionTokens = {
  easeStandard: "cubic-bezier(0.2, 0, 0, 1)",
  easeEmphasized: "cubic-bezier(0.16, 1, 0.3, 1)",
  durationFast: "120ms",
  durationMedium: "220ms",
  durationSlow: "360ms",
} as const;

export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = parseHexColor(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function parseHexColor(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
