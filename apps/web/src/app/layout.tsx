import { resources } from "@virasat/i18n";
import { colors } from "@virasat/ui-tokens";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n/client.tsx";
import { getT } from "@/lib/i18n/server.ts";
import { fontVariables } from "./fonts.ts";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t("app.name"), template: `%s · ${t("app.name")}` },
    description: t("app.tagline"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: colors.light.paper },
    { media: "(prefers-color-scheme: dark)", color: colors.dark.paper },
  ],
};

// Right-to-left languages are added here when they launch (ADR 0005); layouts already use
// logical properties.
const RTL_LOCALES = new Set<string>();

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getT();
  return (
    <html lang={locale} dir={RTL_LOCALES.has(locale) ? "rtl" : "ltr"} className={fontVariables}>
      <body className="flex min-h-dvh flex-col antialiased">
        <I18nProvider key={locale} locale={locale} messages={resources[locale].translation}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
