import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";
import { renderThemeCss } from "./css.ts";
import { colors, fontSize, sizing, surfaceColors, textColors } from "./tokens.ts";

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe.each(["light", "dark"] as const)("%s palette", (mode) => {
  const palette = colors[mode];

  it.each(textColors)("%s text passes WCAG AA on every surface", (name) => {
    for (const surface of surfaceColors) {
      expect(contrastRatio(palette[name], palette[surface]), surface).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    }
  });

  it("text on accent buttons and on uncertain-field highlights passes WCAG AA", () => {
    expect(contrastRatio(palette.accentInk, palette.accent)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(palette.ink, palette.highlight)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("form-control outlines reach 3:1 against paper and surface", () => {
    expect(contrastRatio(palette.outline, palette.paper)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(palette.outline, palette.surface)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("defines the same colour names as the other mode", () => {
    expect(Object.keys(palette).sort()).toEqual(Object.keys(colors.light).sort());
  });
});

describe("elder-facing floors", () => {
  it("match the brief: 20pt text, 56px tap targets", () => {
    expect(fontSize.elder).toBeGreaterThanOrEqual(20);
    expect(sizing.elderTapTarget).toBeGreaterThanOrEqual(56);
  });
});

describe("theme.css", () => {
  it("is in sync with tokens.ts", () => {
    const committed = readFileSync(new URL("../theme.css", import.meta.url), "utf8");
    expect(committed.replace(/\r\n/g, "\n")).toBe(renderThemeCss());
  });
});

describe("contrastRatio", () => {
  it("matches known WCAG values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });
});
