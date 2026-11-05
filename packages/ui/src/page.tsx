import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export function PageHeader({
  title,
  back,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  back?: { href: string; label: string } | undefined;
  actions?: ReactNode;
  /** A small line above the title, e.g. the vault name. */
  eyebrow?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="-ms-2 flex min-h-tap-target items-center gap-1 self-start rounded-full pe-3 ps-1 text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-5 rtl:rotate-180" />
          {back.label}
        </Link>
      )}
      {eyebrow && <p className="text-sm tracking-wide text-muted uppercase">{eyebrow}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {actions}
      </div>
      <div aria-hidden className="rule-motif mt-1 w-28" />
    </header>
  );
}

export function Section({
  title,
  action,
  children,
  className,
  id,
}: {
  id?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("flex scroll-mt-20 flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <h2 className="text-xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
