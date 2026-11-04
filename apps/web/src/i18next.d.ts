import type { TranslationTree } from "@virasat/i18n";

// Typed translation keys: t("vault.peopel") fails to compile.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: TranslationTree };
  }
}
