import "server-only";
import type { Language } from "@virasat/core";
import { resources } from "@virasat/i18n";
import { createInstance, type TFunction } from "i18next";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { getUserId } from "../auth.ts";
import { createClient } from "../supabase/server.ts";
import { isLocale, LOCALE_COOKIE, negotiateLocale } from "./locale.ts";

/** Signed-in: the profile's language. Otherwise the language cookie, then the browser's. */
export const getLocale = cache(async (): Promise<Language> => {
  const userId = await getUserId();
  if (userId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("preferred_language")
      .eq("id", userId)
      .maybeSingle();
    if (isLocale(data?.preferred_language)) return data.preferred_language;
  }
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;
  return negotiateLocale((await headers()).get("accept-language"));
});

export const getT = cache(async (): Promise<{ t: TFunction; locale: Language }> => {
  const locale = await getLocale();
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    fallbackLng: "en",
    resources: { [locale]: resources[locale], en: resources.en },
    initAsync: false,
    interpolation: { escapeValue: false }, // React escapes output.
  });
  return { t: i18n.t, locale };
});
