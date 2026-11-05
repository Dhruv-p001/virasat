import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export function Notice({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md bg-sunken px-4 py-3 ring-1 ring-border ring-inset",
        kind === "error" ? "text-danger" : "text-success",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
