import Link from "next/link";
import type { ComponentProps } from "react";
import { type ButtonKind, type ButtonSize, buttonClass } from "./button.tsx";
import { cn } from "./cn.ts";

export function ButtonLink({
  kind = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { kind?: ButtonKind; size?: ButtonSize }) {
  return <Link className={cn(buttonClass(kind, size), className)} {...props} />;
}
