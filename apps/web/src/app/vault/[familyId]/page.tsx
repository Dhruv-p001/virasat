import { canManageMembers, canWriteContent } from "@virasat/core";
import type { Metadata } from "next";
import { interactiveCard } from "@virasat/ui/card";
import { BookOpen, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { AiModeBanner } from "@/components/ai-mode-banner.tsx";
import { CaptureList } from "@/components/capture-list.tsx";
import { MomentsStrip } from "@/components/moments-strip.tsx";
import { Avatar, ButtonLink, EmptyState, PageShell, Section } from "@/components/ui.tsx";
import { getVault, listOpenCaptures, listPeople } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { listMoments, listRecipes } from "@/lib/moments.ts";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const vault = await getVault((await params).familyId);
  return { title: vault.name };
}

export default async function VaultPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  const canWrite = canWriteContent(vault.role);
  const [people, recipes, moments, captures] = await Promise.all([
    listPeople(familyId),
    listRecipes(familyId),
    listMoments(familyId, 6),
    canWrite ? listOpenCaptures(familyId, 5) : Promise.resolve([]),
  ]);

  return (
    <PageShell
      title={vault.name}
      eyebrow={t("vault.yourRole", { role: t(`roles.${vault.role}`) })}
      actions={
        canManageMembers(vault.role) ? (
          <ButtonLink href={`/vault/${familyId}/invite`} kind="secondary">
            {t("vault.invite")}
          </ButtonLink>
        ) : undefined
      }
    >
      {captures.length > 0 && (
        <Section
          title={t("captures.title")}
          action={
            <Link
              href={`/vault/${familyId}/captures`}
              className="font-semibold text-accent underline underline-offset-4"
            >
              {t("captures.seeAll")}
            </Link>
          }
        >
          <AiModeBanner />
          <CaptureList familyId={familyId} captures={captures} />
        </Section>
      )}

      <MomentsStrip familyId={familyId} moments={moments} />

      <Section
        id="recipes"
        title={t("ui.recipes")}
        action={
          canWrite && recipes.length > 0 ? (
            <Link
              href={`/vault/${familyId}/recipes/new`}
              className="font-semibold text-accent underline underline-offset-4"
            >
              {t("ui.firstRecipe.emptyAction")}
            </Link>
          ) : undefined
        }
      >
        {recipes.length === 0 ? (
          <EmptyState
            icon={<BookOpen />}
            title={t("ui.firstRecipe.emptyTitle")}
            body={t("ui.firstRecipe.emptyBody")}
            action={
              <div className="flex flex-wrap items-center gap-3">
                {canWrite && (
                  <ButtonLink href={`/vault/${familyId}/recipes/new`}>
                    {t("ui.firstRecipe.emptyAction")}
                  </ButtonLink>
                )}
                <ButtonLink href="/sample" kind="quiet">
                  {t("sample.exploreLink")}
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recipes.map((recipe) => {
              const origin = people.find((person) => person.id === recipe.origin_person_id);
              return (
                <li key={recipe.id}>
                  <Link
                    href={`/vault/${familyId}/recipes/${recipe.id}`}
                    className={`${interactiveCard} flex h-full min-h-tap-target flex-col gap-1`}
                    data-testid="recipe-card"
                  >
                    <span className="font-serif text-lg font-semibold">{recipe.title}</span>
                    {origin && (
                      <span className="text-sm text-muted">
                        {t("ui.recipeOf", { name: origin.relation_label ?? origin.display_name })}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section
        id="people"
        title={t("vault.people")}
        action={
          canWrite && people.length > 0 ? (
            <Link
              href={`/vault/${familyId}/people/new`}
              className="font-semibold text-accent underline underline-offset-4"
            >
              {t("vault.addPerson")}
            </Link>
          ) : undefined
        }
      >
        {people.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title={t("vault.peopleEmptyTitle")}
            body={t("vault.peopleEmptyBody")}
            action={
              canWrite ? (
                <ButtonLink href={`/vault/${familyId}/people/new`}>
                  {t("vault.addPerson")}
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/vault/${familyId}/people/${person.id}`}
                  className={`${interactiveCard} flex h-full flex-col items-center gap-3 text-center`}
                >
                  <Avatar
                    name={person.relation_label ?? person.display_name}
                    photoUrl={person.photoUrl}
                    size="lg"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-serif text-lg font-semibold">
                      {person.relation_label ?? person.display_name}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {person.relation_label ? person.display_name : null}
                      {person.relation_label && person.profile_id ? " · " : null}
                      {person.profile_id ? t("vault.hasJoined") : null}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Link
        href={`/vault/${familyId}/members`}
        className="flex min-h-tap-target items-center gap-1 self-start font-semibold text-accent underline underline-offset-4"
      >
        {t("vault.members")}
        <ChevronRight aria-hidden className="size-4 rtl:rotate-180" />
      </Link>
    </PageShell>
  );
}
