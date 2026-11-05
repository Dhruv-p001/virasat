"use client";

import { Mic, PenLine, Plus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@virasat/ui/cn";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@virasat/ui/sheet";
import { buttonClass } from "@virasat/ui/button";
import { useT } from "@/lib/i18n/client.tsx";

type Row = {
  href: string;
  icon: "type" | "capture" | "person" | "invite";
  title: string;
  hint: string;
};

const icons = { type: PenLine, capture: Mic, person: UserPlus, invite: Users };

/**
 * The Add sheet: quick starts that fit a thumb. On a phone the trigger is the raised centre
 * button of the bottom navigation; on a desktop it is a button in the top bar.
 */
export function AddSheet({
  familyId,
  canWrite,
  canInvite,
  variant,
}: {
  familyId: string;
  canWrite: boolean;
  canInvite: boolean;
  variant: "centre" | "bar";
}) {
  const t = useT();
  const rows: Row[] = [];
  if (canWrite) {
    rows.push(
      {
        href: `/vault/${familyId}/recipes/new`,
        icon: "type",
        title: t("ui.add.type"),
        hint: t("ui.add.typeHint"),
      },
      {
        href: `/vault/${familyId}#people`,
        icon: "capture",
        title: t("ui.add.capture"),
        hint: t("ui.add.captureHint"),
      },
      {
        href: `/vault/${familyId}/people/new`,
        icon: "person",
        title: t("ui.add.person"),
        hint: t("ui.add.personHint"),
      },
    );
  }
  if (canInvite) {
    rows.push({
      href: `/vault/${familyId}/invite`,
      icon: "invite",
      title: t("ui.add.invite"),
      hint: t("ui.add.inviteHint"),
    });
  }
  if (rows.length === 0) return null;

  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          variant === "centre"
            ? "-mt-6 flex size-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lift motion-safe:active:scale-95 md:hidden"
            : cn(buttonClass("primary"), "hidden md:inline-flex"),
        )}
        aria-label={variant === "centre" ? t("ui.nav.add") : undefined}
      >
        <Plus aria-hidden className="size-7" />
        {variant === "bar" && t("ui.nav.add")}
      </SheetTrigger>
      <SheetContent title={t("ui.add.title")} description={t("ui.add.description")}>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => {
            const Icon = icons[row.icon];
            return (
              <li key={row.href}>
                <SheetClose asChild>
                  <Link
                    href={row.href}
                    className="flex min-h-elder-tap-target items-center gap-4 rounded-lg bg-surface p-3 shadow-album ring-1 ring-border ring-inset"
                  >
                    <span
                      aria-hidden
                      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken text-accent"
                    >
                      <Icon className="size-6" />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-semibold">{row.title}</span>
                      <span className="text-sm text-muted">{row.hint}</span>
                    </span>
                  </Link>
                </SheetClose>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
