import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Without this, tailwind-merge reads our `text-elder` size as a colour and drops one of them.
const merge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["elder"] }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
