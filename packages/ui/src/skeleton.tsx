import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.ts";

/** A loading placeholder shaped like the content it stands in for. Hidden from screen readers. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton rounded-md", className)} {...props} />;
}

/** A loading region: one polite announcement, with the skeleton shapes as children. */
export function SkeletonRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
