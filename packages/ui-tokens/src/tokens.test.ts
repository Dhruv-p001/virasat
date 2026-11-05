import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blend, contrastRatio } from "./contrast.ts";
import { renderThemeCss } from "./css.ts";
import { backdrop, colors, fontSize, sizing, surfaceColors, textColors } from "./tokens.ts";

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

describe.each(["light", "dark"] as const)("%s page backdrop", (mode) => {
  const palette = colors[mode];
  const toHex = (rgb: readonly number[]) =>
    `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`;

  // The worst spot: both corner glows at full strength and the densest grain speck on top.
  const [glow] = backdrop.glowPercent;
  const grain = backdrop.grain[mode];
  const worst = blend(
    toHex(grain.rgb),
    blend(palette.accent, palette.paper, glow / 100),
    grain.maxAlpha,
  );

  it.each(textColors)("%s text keeps WCAG AA on the worst spot of the backdrop", (name) => {
    expect(contrastRatio(palette[name], worst)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("keeps form-control outlines at 3:1 on it", () => {
    expect(contrastRatio(palette.outline, worst)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});

describe("page backdrop CSS", () => {
  const css = readFileSync(
    new URL("../../../apps/web/src/app/globals.css", import.meta.url),
    "utf8",
  );

  it("uses the glow strengths from the tokens", () => {
    for (const percent of backdrop.glowPercent) {
      expect(css).toContain(`var(--color-accent) ${percent}%`);
    }
  });

  it("never lets a grain speck be more opaque than the tokens allow", () => {
    // The grain is an SVG whose alpha row is "0 0 0 <scale> <shift>", URL-encoded in the CSS.
    const rows = [...css.matchAll(/0%200%200%20([\d.]+)%20(-?[\d.]+)%22/g)];
    expect(rows).toHaveLength(4); // light, dark (system), and the two data-theme overrides
    for (const [, scale, shift] of rows) {
      // Fractal noise alpha runs from 0 to 1, so a speck is at most scale + shift.
      expect(Number(scale) + Number(shift)).toBeLessThanOrEqual(backdrop.grain.light.maxAlpha);
    }
  });
});
