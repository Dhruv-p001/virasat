import { canManageMembers, canWriteContent } from "@virasat/core";
import { BottomNav, type NavItem, TopNavLinks } from "@virasat/ui/nav";
import { Toaster } from "@virasat/ui/toaster";
import { Heart, Home, User } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { setLocaleCookie } from "@/app/actions/locale.ts";
import { getUserId } from "@/lib/auth.ts";
import { getVault, listMyVaults } from "@/lib/data.ts";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale.ts";
import { getT } from "@/lib/i18n/server.ts";
import { AddSheet } from "./add-sheet.tsx";
import { LanguageSelect } from "./language-select.tsx";

/**
 * The chrome around every signed-in screen: a top bar with the destinations on desktop, a bottom
 * navigation on phones, and the Add sheet. Signed-out visitors get a plain bar with the language
 * picker. The elder-facing /record page does not use this.
 */
export async function AppShell({
  familyId,
  children,
}: {
  /** The vault being viewed, when the route has one. Otherwise the user's only vault, if any. */
  familyId?: string;
  children: ReactNode;
}) {
  const [{ t, locale }, userId] = await Promise.all([getT(), getUserId()]);

  let vaultId = familyId;
  if (userId && !vaultId) {
    const vaults = await listMyVaults();
    if (vaults.length === 1) vaultId = vaults[0]?.id;
  }
  const vault = userId && vaultId ? await getVault(vaultId) : null;

  const items: NavItem[] = [];
  if (userId) {
    items.push({
      href: vault ? `/vault/${vault.id}` : "/",
      label: t("ui.nav.vault"),
      icon: <Home />,
    });
    if (vault) {
      items.push({
        href: `/vault/${vault.id}/moments`,
        label: t("ui.nav.moments"),
        icon: <Heart />,
      });
    }
    items.push({ href: "/settings", label: t("ui.nav.you"), icon: <User /> });
  }

  const canWrite = vault ? canWriteContent(vault.role) : false;
  const canInvite = vault ? canManageMembers(vault.role) : false;

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
          {userId ? (
            <div className="flex items-center gap-2">
              <TopNavLinks label={t("ui.nav.label")} items={items} />
              {vault && (
                <AddSheet
                  familyId={vault.id}
                  canWrite={canWrite}
                  canInvite={canInvite}
                  variant="bar"
                />
              )}
            </div>
          ) : (
            <form action={setLocaleCookie}>
              <LanguageSelect
                name="locale"
                defaultValue={locale}
                label={t("settings.language")}
                options={SUPPORTED_LOCALES.map((code) => ({
                  value: code,
                  label: t(`languages.${code}`),
                }))}
                submitOnChange
              />
            </form>
          )}
        </div>
      </header>
      <div className="flex flex-1 flex-col pb-24 md:pb-0">{children}</div>
      {userId && (
        <BottomNav
          label={t("ui.nav.label")}
          items={items}
          centre={
            vault && (
              <AddSheet
                familyId={vault.id}
                canWrite={canWrite}
                canInvite={canInvite}
                variant="centre"
              />
            )
          }
        />
      )}
      <Toaster />
    </>
  );
}
