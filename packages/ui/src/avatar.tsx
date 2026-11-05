import { cn } from "./cn.ts";

// Deliberately light: the elder-facing /record page imports this, and it has a performance
// budget (docs/adr/0015-ui-stack.md). Only clsx and tailwind-merge come with it.

/** Initials, or the photo when there is one. Initials take the first grapheme of each word. */
export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null | undefined;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "size-20 text-2xl" : "size-12 text-lg";
  if (photoUrl) {
    return (
      // A plain img on purpose: signed, short-lived private URLs, which next/image would proxy and cache.
      <img
        src={photoUrl}
        alt=""
        className={cn(dimension, "shrink-0 rounded-full object-cover ring-2 ring-surface")}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        dimension,
        "flex shrink-0 items-center justify-center rounded-full bg-sunken font-serif font-semibold text-accent ring-2 ring-surface",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function initials(name: string): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? "")
    .join("");
}
