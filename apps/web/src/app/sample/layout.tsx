import { ButtonLink } from "@virasat/ui/link-button";
import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server.ts";

// The example family is open to everyone, signed in or not, and reads nothing from the database.

export default async function SampleLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-lift"
      >
        {t("ui.skipToContent")}
      </a>
      <header className="border-b border-border bg-paper/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="flex min-h-tap-target items-center font-serif text-xl font-semibold"
          >
            {t("app.name")}
          </Link>
          <ButtonLink href="/sign-in" className="hidden md:inline-flex">
            {t("sample.startOwn")}
          </ButtonLink>
        </div>
      </header>
      <p className="bg-sunken px-4 py-2 text-center text-sm text-muted" data-testid="sample-banner">
        {t("sample.banner")}
      </p>
      <div className="page-in flex flex-1 flex-col pb-24 md:pb-0">{children}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <ButtonLink href="/sign-in" className="w-full">
          {t("sample.startOwn")}
        </ButtonLink>
      </div>
    </>
  );
}
