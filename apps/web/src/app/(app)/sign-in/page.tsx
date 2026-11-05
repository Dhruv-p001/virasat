import { safeNextPath } from "@virasat/core";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth.ts";
import { publicEnv } from "@/lib/env.ts";
import { getT } from "@/lib/i18n/server.ts";
import { SignInForm } from "./sign-in-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("signIn.title") };
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next: rawNext, error } = await searchParams;
  const next = safeNextPath(rawNext);
  if (await getUserId()) redirect(next);

  const { t, locale } = await getT();
  return (
    <main id="main" className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t("signIn.title")}</h1>
        <p className="text-lg text-muted">{t("signIn.subtitle")}</p>
      </header>
      <div className="rounded-lg bg-surface p-5 shadow-album ring-1 ring-border ring-inset">
        <SignInForm
          next={next}
          locale={locale}
          siteUrl={publicEnv.siteUrl}
          oauthProviders={publicEnv.oauthProviders}
          initialError={error === "link" ? "signIn.linkExpired" : null}
        />
      </div>
      <p className="text-sm text-muted">{t("signIn.privacy")}</p>
    </main>
  );
}
