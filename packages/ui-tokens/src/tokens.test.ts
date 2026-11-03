import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast.ts";
import { renderThemeCss } from "./css.ts";
import { colors, fontSize, sizing } from "./tokens.ts";

const AA_TEXT = 4.5;

describe.each(["light", "dark"] as const)("%s palette", (mode) => {
  const palette = colors[mode];

  it.each(["ink", "muted", "turmeric", "terracotta", "leaf"] as const)(
    "%s text passes WCAG AA on paper and surface",
    (name) => {
      expect(contrastRatio(palette[name], palette.paper)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(palette[name], palette.surface)).toBeGreaterThanOrEqual(AA_TEXT);
    },
  );
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
