"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "./cn.ts";

export type NavItem = {
  href: string;
  label: string;
  /** A decorative icon element, e.g. `<Home />`. */
  icon: ReactNode;
  /** Highlight for these path prefixes too. */
  matches?: string[];
};

/** Length of the longest prefix of this item that the path is inside, or -1. */
function matchLength(pathname: string, item: NavItem): number {
  const lengths = [item.href, ...(item.matches ?? [])].map((prefix) => {
    if (prefix === "/") return pathname === "/" ? 1 : -1;
    return pathname === prefix || pathname.startsWith(`${prefix}/`) ? prefix.length : -1;
  });
  return Math.max(...lengths);
}

/** The most specific item wins, so /vault/x/moments does not also light up Vault. */
export function currentHref(pathname: string, items: NavItem[]): string | null {
  let best: { href: string; length: number } | null = null;
  for (const item of items) {
    const length = matchLength(pathname, item);
    if (length > (best?.length ?? -1)) best = { href: item.href, length };
  }
  return best?.href ?? null;
}

/**
 * Phone navigation, within thumb reach. `centre` is the raised Add button (a sheet trigger);
 * it sits between the items.
 */
export function BottomNav({
  label,
  items,
  centre,
}: {
  label: string;
  items: NavItem[];
  centre?: ReactNode;
}) {
  const current = currentHref(usePathname(), items);
  const half = Math.ceil(items.length / 2);
  const link = (item: NavItem) => {
    const isCurrent = item.href === current;
    return (
      <li key={item.href} className="flex-1">
        <Link
          href={item.href}
          aria-current={isCurrent ? "page" : undefined}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-sm font-medium [&_svg]:size-6",
            isCurrent ? "text-accent" : "text-muted",
          )}
        >
          <span
            aria-hidden
            className={cn("rounded-full px-4 py-0.5 transition-colors", isCurrent && "bg-sunken")}
          >
            {item.icon}
          </span>
          {item.label}
        </Link>
      </li>
    );
  };
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-center px-2">
        {items.slice(0, half).map(link)}
        {centre && <li className="flex flex-1 justify-center">{centre}</li>}
        {items.slice(half).map(link)}
      </ul>
    </nav>
  );
}

/** The same destinations as a row in the desktop top bar. */
export function TopNavLinks({ label, items }: { label: string; items: NavItem[] }) {
  const current = currentHref(usePathname(), items);
  return (
    <nav aria-label={label} className="hidden md:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const isCurrent = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex min-h-tap-target items-center gap-2 rounded-full px-4 font-medium [&_svg]:size-5",
                  isCurrent ? "bg-sunken text-accent" : "text-muted hover:text-ink",
                )}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
