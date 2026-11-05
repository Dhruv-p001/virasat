import { canWriteContent } from "@virasat/core";
import { Card } from "@virasat/ui/card";
import { RecipeArt } from "@virasat/ui/illustrations";
import { Camera, Mic } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui.tsx";
import { getVault, listPeople } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { TypedRecipeForm } from "./typed-recipe-form.tsx";

type Props = {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ first?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("ui.firstRecipe.title") };
}

export default async function NewRecipePage({ params, searchParams }: Props) {
  const { familyId } = await params;
  const { first } = await searchParams;
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  if (!canWriteContent(vault.role)) notFound();
  const people = await listPeople(familyId);
  // Recording or photographing starts from a person: pick one, or add the first.
  const startFrom =
    people.length > 0 ? `/vault/${familyId}#people` : `/vault/${familyId}/people/new`;

  return (
    <PageShell
      title={t("ui.firstRecipe.title")}
      eyebrow={vault.name}
      back={first ? undefined : { href: `/vault/${familyId}`, label: vault.name }}
    >
      {first && (
        <div aria-hidden className="-mt-2 w-36">
          <RecipeArt />
        </div>
      )}
      <p className="-mt-4 max-w-prose text-lg text-muted">{t("ui.firstRecipe.body")}</p>
      <TypedRecipeForm
        familyId={familyId}
        people={people.map((person) => ({
          id: person.id,
          label: person.relation_label ?? person.display_name,
        }))}
      />
      {first && (
        <>
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg">{t("ui.firstRecipe.otherWays")}</h2>
            <ul className="flex flex-col gap-1">
              {(
                [
                  [Mic, t("ui.firstRecipe.record")],
                  [Camera, t("ui.firstRecipe.photograph")],
                ] as const
              ).map(([Icon, label]) => (
                <li key={label}>
                  <Link
                    href={startFrom}
                    className="flex min-h-tap-target items-center gap-3 font-semibold text-accent underline underline-offset-4"
                  >
                    <Icon aria-hidden className="size-5" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Link
            href={`/vault/${familyId}`}
            className="flex min-h-tap-target items-center self-start text-muted underline underline-offset-4"
          >
            {t("ui.firstRecipe.skip")}
          </Link>
        </>
      )}
    </PageShell>
  );
}
