import type { ReactNode } from "react";
import { cn } from "./cn.ts";

/** An empty state always points at the next action (brief section 8). */
export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  /** A decorative icon element, e.g. `<Mic />`. */
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border-2 border-dashed border-border bg-surface/60 px-5 py-8",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-sunken text-accent [&_svg]:size-6"
        >
          {icon}
        </span>
      )}
      <h3 className="text-xl">{title}</h3>
      <p className="max-w-prose text-muted">{body}</p>
      {action}
    </div>
  );
}
