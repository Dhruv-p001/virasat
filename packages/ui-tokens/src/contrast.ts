/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`Expected #RRGGBB, got ${hex}`);
  const [r, g, b] = match.slice(1).map((part) => {
    const c = parseInt(part, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `foreground` laid over `background` at `alpha` (0 to 1), as #RRGGBB. For checking text over a tint. */
export function blend(foreground: string, background: string, alpha: number): string {
  const channels = (hex: string) => {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!match) throw new Error(`Expected #RRGGBB, got ${hex}`);
    return match.slice(1).map((part) => parseInt(part, 16)) as [number, number, number];
  };
  const [f, b] = [channels(foreground), channels(background)];
  const mixed = f.map((value, index) => Math.round(value * alpha + (b[index] ?? 0) * (1 - alpha)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}
