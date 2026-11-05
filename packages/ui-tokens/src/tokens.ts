// Warm, culture-neutral family-album palette (ADR 0005). The culture comes from each family's
// photos, voices and words, not from the chrome.

export const colors = {
  light: {
    paper: "#F6F1E8",
    surface: "#FFFCF6",
    sunken: "#EDE6DA",
    ink: "#24201B",
    muted: "#665E55",
    accent: "#8B4A2B",
    accentInk: "#FFFCF6",
    /** Background for fields the AI was unsure about, on the review screen. */
    highlight: "#F4E3B5",
    danger: "#9E2F25",
    success: "#33613D",
    /** Decorative dividers. */
    border: "#DDD3C4",
    /** Form-control borders and focus rings; must reach 3:1 (WCAG 1.4.11). */
    outline: "#857A6E",
  },
  dark: {
    paper: "#171411",
    surface: "#211D19",
    sunken: "#100E0C",
    ink: "#F2ECE2",
    muted: "#B4AA9D",
    accent: "#E0A27E",
    accentInk: "#1E130D",
    highlight: "#4A3A17",
    danger: "#EE8F84",
    success: "#8FC49A",
    border: "#3B342D",
    outline: "#8A8075",
  },
} as const;

export type ColorName = keyof typeof colors.light;

/** Text colours that must pass WCAG AA (4.5:1) on paper, surface and sunken. */
export const textColors = [
  "ink",
  "muted",
  "accent",
  "danger",
  "success",
] as const satisfies ColorName[];

/** Surfaces that text sits on. */
export const surfaceColors = ["paper", "surface", "sunken"] as const satisfies ColorName[];

export const fontSize = {
  sm: 14,
  base: 16,
  lg: 18,
  /** Floor for every elder-facing screen (brief section 8). */
  elder: 20,
  xl: 24,
  "2xl": 32,
  "3xl": 44,
} as const;

export const sizing = {
  tapTarget: 44,
  /** Floor for every elder-facing control (brief section 8). */
  elderTapTarget: 56,
  recordButton: 160,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  full: 9999,
} as const;

/**
 * The page backdrop (ADR 0018): a soft accent glow in two corners and a faint paper grain, behind
 * every page. These numbers are the ceiling the CSS in apps/web/src/app/globals.css may not pass,
 * so text keeps its contrast over the worst spot of it. Tests check both the contrast and the CSS.
 */
export const backdrop = {
  /** The two corner glows, as a percentage of the accent colour. */
  glowPercent: [5, 4],
  /** The grain's speck colour (r, g, b) and the most opaque a speck can be, 0 to 1. */
  grain: {
    light: { rgb: [92, 69, 46], maxAlpha: 0.08 },
    dark: { rgb: [242, 219, 189], maxAlpha: 0.08 },
  },
} as const;
