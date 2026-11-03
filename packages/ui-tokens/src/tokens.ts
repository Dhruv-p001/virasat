// Placeholder palette until the brand direction is decided (brief section 12).
// Family album, not food blog: warm paper, deep ink, turmeric and terracotta accents.

export const colors = {
  light: {
    paper: "#F7F1E6",
    surface: "#FFFBF4",
    ink: "#2A1E16",
    muted: "#6B5A4C",
    turmeric: "#8F5E06",
    terracotta: "#A4441F",
    leaf: "#3F5A2E",
    border: "#E2D6C3",
  },
  dark: {
    paper: "#1C1612",
    surface: "#261E18",
    ink: "#F3EADB",
    muted: "#BBAA97",
    turmeric: "#E8B04A",
    terracotta: "#E0855E",
    leaf: "#9CBB7C",
    border: "#3A2F27",
  },
} as const;

export type ColorName = keyof typeof colors.light;

export const fontSize = {
  sm: 14,
  base: 16,
  lg: 18,
  /** Floor for every elder-facing screen (brief section 8). */
  elder: 20,
  xl: 24,
  "2xl": 32,
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
