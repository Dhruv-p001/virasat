import en from "../locales/en.json" with { type: "json" };
import gu from "../locales/gu.json" with { type: "json" };
import hi from "../locales/hi.json" with { type: "json" };

export type TranslationTree = typeof en;

// English is the source of truth for keys; the other locales are checked against it in tests.
export const resources = {
  en: { translation: en },
  hi: { translation: hi satisfies TranslationTree },
  gu: { translation: gu satisfies TranslationTree },
} as const;

export const supportedLocales = Object.keys(resources) as (keyof typeof resources)[];
export const defaultLocale = "en";
