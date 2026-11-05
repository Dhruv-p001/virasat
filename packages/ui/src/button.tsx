import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

export type ButtonKind = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "elder";

const kinds: Record<ButtonKind, string> = {
  primary: "bg-accent text-accent-ink shadow-album hover:brightness-110",
  secondary: "border-2 border-outline bg-surface text-ink hover:bg-sunken",
  quiet: "text-accent underline underline-offset-4 hover:bg-sunken",
  danger: "border-2 border-danger text-danger hover:bg-sunken",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-tap-target px-5",
  // Elder pages: 56px targets and 20pt text (brief section 8).
  elder: "min-h-elder-tap-target px-7 text-elder",
};

/** Class names for anything that should look like a button (a link, a menu trigger). */
export function buttonClass(kind: ButtonKind = "primary", size: ButtonSize = "md"): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition",
    "motion-safe:active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60",
    kinds[kind],
    sizes[size],
  );
}

export function Button({
  kind = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { kind?: ButtonKind; size?: ButtonSize }) {
  return <button type="button" className={cn(buttonClass(kind, size), className)} {...props} />;
}
