import { colors, type ColorName } from "@virasat/ui-tokens";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@virasat/ui/button";
import { Card, interactiveCard, PhotoFrame } from "@virasat/ui/card";
import { ConfirmMoment } from "@virasat/ui/confirm-moment";
import { EmptyState } from "@virasat/ui/empty-state";
import { Notice } from "@virasat/ui/notice";
import { Skeleton, SkeletonRegion } from "@virasat/ui/skeleton";
import { Mic } from "lucide-react";
import type { ReactNode } from "react";
import { StyleInteractive } from "./interactive.tsx";

// Design review page: every token and core pattern, in light and dark, in all three launch scripts.
// Not part of the product; hidden in production.

export const metadata: Metadata = { title: "Style · Virasat", robots: { index: false } };

export default function StylePage() {
  if (process.env.NODE_ENV === "production" && process.env.VIRASAT_SHOW_STYLE !== "1") notFound();

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <Specimen theme="light" />
      <Specimen theme="dark" />
    </main>
  );
}

function Specimen({ theme }: { theme: "light" | "dark" }) {
  return (
    <div data-theme={theme} className="bg-paper text-ink">
      <div className="mx-auto flex max-w-xl flex-col gap-12 px-4 py-10 sm:px-8">
        <header className="flex flex-col gap-1">
          <p className="text-sm tracking-wide text-muted uppercase">{theme} mode</p>
          <h1 className="text-3xl font-semibold">Virasat</h1>
          <p className="text-lg text-muted">
            Family recipes, in the voices of the people who made them.
          </p>
        </header>

        <Section title="Type in three scripts">
          <div className="flex flex-col gap-5">
            <Sample
              lang="en"
              heading="Ba’s methi thepla"
              body="She made these for every train journey, wrapped in newspaper, still warm at the station."
            />
            <Sample
              lang="gu"
              heading="બાના મેથીના થેપલા"
              body="દરેક ટ્રેન મુસાફરી માટે બા આ બનાવતા, છાપામાં વીંટાળીને."
            />
            <Sample
              lang="hi"
              heading="बा के मेथी थेपले"
              body="हर रेल यात्रा के लिए बा ये बनाती थीं, अख़बार में लपेटकर।"
            />
          </div>
        </Section>

        <Section title="Recipe of">
          <PersonCard />
          <Lineage />
        </Section>

        <Section title="Ingredients: her words first">
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            <Ingredient original="mutthi bhar besan" suggestion="≈ 30 g gram flour" />
            <Ingredient original="be vaati ghau no lot" suggestion="≈ 2 cups whole-wheat flour" />
            <Ingredient original="tel jarur pramane" suggestion="Oil, as needed" uncertain />
            <Ingredient original="ek juddi methi" suggestion="≈ 1 bunch fenugreek leaves" />
          </ul>
          <p className="text-sm text-muted">
            The highlighted line is one the AI was unsure about. The review screen asks the
            organiser to check it before saving.
          </p>
        </Section>

        <Section title="Elder recording screen">
          <div className="flex flex-col items-center gap-5 rounded-lg bg-surface px-4 py-10 text-center">
            <Avatar initials="બા" size="lg" />
            <p className="text-elder font-semibold" lang="gu">
              બા, તમારી રેસીપી કહો
            </p>
            <button
              type="button"
              className="flex size-record-button flex-col items-center justify-center gap-2 rounded-full bg-accent text-accent-ink shadow-lg"
              aria-label="Tap to record"
            >
              <MicIcon />
              <span className="text-elder font-semibold" lang="gu">
                દબાવો
              </span>
            </button>
            <p className="text-elder text-muted" lang="gu">
              રેકોર્ડ કરવા માટે દબાવો
            </p>
          </div>
        </Section>

        <Section title="Actions and fields">
          <div className="flex flex-wrap gap-3">
            <Button kind="primary">Save recipe</Button>
            <Button kind="secondary">Invite family</Button>
            <Button kind="quiet">Not now</Button>
            <Button kind="danger">Remove recording</Button>
          </div>
          <label className="flex flex-col gap-2">
            <span className="font-medium">Their name in the family</span>
            <input
              defaultValue="Ba"
              className="min-h-tap-target rounded-md border-2 border-outline bg-surface px-3 text-lg"
            />
            <span className="text-sm text-muted">
              What the grandchildren call them, like Ba, Nani or Oma.
            </span>
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-sunken px-3 py-1">Family vault</span>
            <span className="rounded-full bg-sunken px-3 py-1 text-success">Confirmed</span>
            <span className="rounded-full bg-sunken px-3 py-1 text-danger">
              Original recording removed
            </span>
          </div>
        </Section>

        <Section title="Empty state">
          <EmptyState
            icon={<Mic />}
            title="Record your first family recipe"
            body="Sit with someone who cooks from memory, or send them a link to record from their own phone."
            action={<Button kind="primary">Start recording</Button>}
          />
        </Section>

        <Section title="Album surfaces">
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col gap-1">
              <span className="font-serif text-lg font-semibold">Card</span>
              <span className="text-sm text-muted">Warm page, soft edge</span>
            </Card>
            <a href="#top" className={`${interactiveCard} flex flex-col gap-1`}>
              <span className="font-serif text-lg font-semibold">Link card</span>
              <span className="text-sm text-muted">Lifts on hover</span>
            </a>
          </div>
          <PhotoFrame className="max-w-48">
            <div className="flex h-32 items-center justify-center rounded-sm bg-sunken font-serif text-3xl text-accent">
              Ba
            </div>
          </PhotoFrame>
          <Button kind="primary" size="elder">
            Elder-sized button
          </Button>
        </Section>

        <Section title="Loading, notices and confirm">
          <SkeletonRegion label="Loading the recipe" className="flex flex-col gap-3">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </SkeletonRegion>
          <Notice kind="success">Saved to the vault.</Notice>
          <Notice kind="error">We couldn’t save that. Please try again.</Notice>
          <ConfirmMoment title="Recipe saved" />
        </Section>

        <Section title="Sheet, dialog, menu, tabs and toast">
          <StyleInteractive />
        </Section>

        <Section title="Palette">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(Object.keys(colors[theme]) as ColorName[]).map((name) => (
              <li key={name} className="flex items-center gap-3">
                <span
                  className="size-10 shrink-0 rounded-md border border-border"
                  style={{ backgroundColor: colors[theme][name] }}
                />
                <span className="flex flex-col text-sm">
                  <span className="font-medium">{name}</span>
                  <span className="text-muted">{colors[theme][name]}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-border pb-2 text-xl">{title}</h2>
      {children}
    </section>
  );
}

function Sample({ lang, heading, body }: { lang: string; heading: string; body: string }) {
  return (
    <div lang={lang} className="flex flex-col gap-1">
      <h3 className="text-2xl font-semibold">{heading}</h3>
      <p className="text-lg leading-relaxed">{body}</p>
    </div>
  );
}

function Avatar({ initials, size = "md" }: { initials: string; size?: "md" | "lg" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-sunken font-serif font-semibold text-accent ${
        size === "lg" ? "size-20 text-2xl" : "size-12 text-lg"
      }`}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function PersonCard() {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface p-4">
      <Avatar initials="Ba" />
      <div className="flex flex-col">
        <span className="text-lg font-semibold">Ba’s recipe</span>
        <span className="text-muted">Kantaben Shah · 12 recipes · recorded 3 Nov 2026</span>
      </div>
      <button
        type="button"
        className="ms-auto flex min-h-tap-target items-center gap-2 rounded-full border-2 border-outline px-4"
        aria-label="Play Ba telling this recipe"
      >
        <PlayIcon />
        <span>4:12</span>
      </button>
    </div>
  );
}

function Lineage() {
  const steps = ["Ba", "Mom", "You"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Passed down">
      {steps.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span className="rounded-full bg-sunken px-3 py-1 font-medium">{step}</span>
          {index < steps.length - 1 && (
            <span className="text-muted rtl:rotate-180" aria-hidden>
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function Ingredient({
  original,
  suggestion,
  uncertain = false,
}: {
  original: string;
  suggestion: string;
  uncertain?: boolean;
}) {
  return (
    <li
      className={`flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 ${
        uncertain ? "bg-highlight" : ""
      }`}
    >
      <span className="text-lg font-medium italic">“{original}”</span>
      <span className="text-muted sm:text-end">
        {uncertain && <span className="me-2 font-semibold text-ink">Check this ·</span>}
        {suggestion}
      </span>
    </li>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 rtl:-scale-x-100" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
