import type { ComponentProps } from "react";
import { cn } from "./cn.ts";

/** An album page: warm surface, soft inset edge and a gentle shadow. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-lg bg-surface p-4 shadow-album ring-1 ring-border ring-inset",
        className,
      )}
    />
  );
}

/** A card that is a link: lifts a little on hover and shows a clear focus ring. */
export const interactiveCard =
  "block rounded-lg bg-surface p-4 shadow-album ring-1 ring-border ring-inset transition motion-safe:hover:-translate-y-0.5 hover:shadow-lift";

/** A photo in a paper mat, like a print in an album. */
export function PhotoFrame({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("mat overflow-hidden", className)} />;
}
