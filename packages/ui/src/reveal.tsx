import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn.ts";

/**
 * Lets a block settle in after the ones before it (a short fade and rise). Pure CSS, so nothing is
 * hidden waiting for JavaScript, and it is switched off under reduced motion. `index` is the
 * block's place in the page: 0 first, then 1, 2 ...
 */
export function Reveal({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("reveal", className)} style={{ "--i": index } as CSSProperties}>
      {children}
    </div>
  );
}
