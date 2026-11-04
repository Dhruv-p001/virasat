import { COUNTRY_CODES } from "@virasat/core";
import type { Metadata } from "next";
import { PageShell } from "@/components/ui.tsx";
import { requireUserId } from "@/lib/auth.ts";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locale.ts";
import { getT } from "@/lib/i18n/server.ts";
import { createClient } from "@/lib/supabase/server.ts";
import { ProfileForm } from "./profile-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("settings.title") };
}

export default async function SettingsPage() {
  const userId = await requireUserId("/settings");
  const [{ t, locale }, supabase] = await Promise.all([getT(), createClient()]);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, preferred_language, unit_system, country_code")
    .eq("id", userId)
    .single();
  if (error) throw error;

  const regionNames = new Intl.DisplayNames([locale], { type: "region" });
  const countries = COUNTRY_CODES.map((code) => ({
    value: code,
    label: regionNames.of(code) ?? code,
  })).sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <PageShell title={t("settings.title")}>
      <ProfileForm
        profile={profile}
        languages={SUPPORTED_LOCALES.map((code) => ({
          value: code,
          label: t(`languages.${code}`),
        }))}
        countries={countries}
      />
      <form action="/auth/sign-out" method="post" className="border-t border-border pt-6">
        <button
          type="submit"
          className="min-h-tap-target font-semibold text-danger underline underline-offset-4"
        >
          {t("nav.signOut")}
        </button>
      </form>
    </PageShell>
  );
}
