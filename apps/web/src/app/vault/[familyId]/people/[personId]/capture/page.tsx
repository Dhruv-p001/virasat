import { canWriteContent } from "@virasat/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiModeBanner } from "@/components/ai-mode-banner.tsx";
import { PageShell } from "@/components/ui.tsx";
import { getPerson, getVault } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { PageCapture } from "./page-capture.tsx";
import { VoiceCapture } from "./voice-capture.tsx";

type Props = {
  params: Promise<{ familyId: string; personId: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ familyId, personId }, { mode }, { t }] = await Promise.all([
    params,
    searchParams,
    getT(),
  ]);
  await getVault(familyId);
  const person = await getPerson(familyId, personId);
  const name = person.relation_label ?? person.display_name;
  return { title: t(mode === "pages" ? "capture.pagesTitle" : "capture.voiceTitle", { name }) };
}

/** Capturing a recipe in the app: record the person, or photograph their handwritten pages. */
export default async function CapturePage({ params, searchParams }: Props) {
  const [{ familyId, personId }, { mode }] = await Promise.all([params, searchParams]);
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  // Viewers can't add recipes: there is nothing here for them.
  if (!canWriteContent(vault.role)) notFound();
  const person = await getPerson(familyId, personId);
  const name = person.relation_label ?? person.display_name;
  const pages = mode === "pages";

  return (
    <PageShell
      title={t(pages ? "capture.pagesTitle" : "capture.voiceTitle", { name })}
      back={{ href: `/vault/${familyId}/people/${personId}`, label: name }}
    >
      <p className="-mt-4 text-muted">
        {t(pages ? "capture.pagesIntro" : "capture.voiceIntro", { name })}
      </p>
      <AiModeBanner />
      {pages ? (
        <PageCapture familyId={familyId} personId={personId} />
      ) : (
        <VoiceCapture familyId={familyId} personId={personId} name={name} />
      )}
    </PageShell>
  );
}
