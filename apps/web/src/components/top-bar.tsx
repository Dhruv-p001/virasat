import Link from "next/link";
import { setLocaleCookie } from "@/app/actions/locale.ts";
import { getUserId } from "@/lib/auth.ts";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale.ts";
import { getT } from "@/lib/i18n/server.ts";
import { LanguageSelect } from "./language-select.tsx";

export async function TopBar() {
  const [{ t, locale }, userId] = await Promise.all([getT(), getUserId()]);
  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="font-serif text-xl font-semibold">
          {t("app.name")}
        </Link>
        {userId ? (
          <Link
            href="/settings"
            className="flex min-h-tap-target items-center text-muted underline-offset-4 hover:underline"
          >
            {t("nav.settings")}
          </Link>
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
    </nav>
  );
}
