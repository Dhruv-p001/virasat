"use client";

import type { Language } from "@virasat/core";
import type { TranslationTree } from "@virasat/i18n";
import { createInstance } from "i18next";
import { type ReactNode, useState } from "react";
import { I18nextProvider, initReactI18next, useTranslation } from "react-i18next";

/** Client-side translations for one locale. The server passes only that locale's strings. */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Language;
  messages: TranslationTree;
  children: ReactNode;
}) {
  const [i18n] = useState(() => {
    const instance = createInstance();
    void instance.use(initReactI18next).init({
      lng: locale,
      resources: { [locale]: { translation: messages } },
      initAsync: false,
      interpolation: { escapeValue: false },
    });
    return instance;
  });
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function useT() {
  return useTranslation().t;
}

/**
 * Translates a key that arrived at runtime (a server action's message or a field error).
 * Unknown keys show the generic error rather than a raw key.
 */
export function useMessage() {
  const { t, i18n } = useTranslation();
  // Runtime keys can't be checked by the compiler; i18n.exists checks them instead.
  const translate = t as unknown as (key: string) => string;
  return (key: string) => translate(i18n.exists(key) ? key : "errors.generic");
}
