import { LanguageSchema, type Language } from "@virasat/core";

export const SUPPORTED_LOCALES = LanguageSchema.options;
export const DEFAULT_LOCALE: Language = "en";
export const LOCALE_COOKIE = "virasat_lang";

export function isLocale(value: unknown): value is Language {
  return LanguageSchema.safeParse(value).success;
}

/** Best supported match for an Accept-Language header, e.g. "gu-IN,gu;q=0.9,en;q=0.8" -> "gu". */
export function negotiateLocale(acceptLanguage: string | null | undefined): Language {
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { base: tag.toLowerCase().split("-")[0], q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((entry) => entry.base).find(isLocale) ?? DEFAULT_LOCALE;
}
