import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn.ts";

export function Field({
  label,
  hint,
  error,
  optional,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | undefined;
  optional?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-medium">
        {label}
        {optional && <span className="ms-2 text-sm font-normal text-muted">{optional}</span>}
      </span>
      {children}
      {hint && !error && <span className="text-sm text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="text-sm font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

const inputBase =
  "min-h-tap-target w-full rounded-md border-2 border-outline bg-surface px-3 text-lg transition-colors placeholder:text-muted aria-invalid:border-danger";

export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputBase, className)} {...props} />;
}

export function TextArea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputBase, "py-2", className)} rows={4} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputBase, className)} {...props} />;
}
