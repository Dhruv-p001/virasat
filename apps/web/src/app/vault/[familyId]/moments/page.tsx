import { canManageMembers, canWriteContent } from "@virasat/core";
import { Camera } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button.tsx";
import { CookedSheet } from "@/components/cooked-sheet.tsx";
import { MomentCard } from "@/components/moment-card.tsx";
import { ButtonLink, EmptyState, PageShell } from "@/components/ui.tsx";
import { getVault } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { listMoments, listRecipes } from "@/lib/moments.ts";
import { removeMoment } from "./actions.ts";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("moments.title") };
}

export default async function MomentsPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t, locale }] = await Promise.all([getVault(familyId), getT()]);
  const [moments, recipes] = await Promise.all([listMoments(familyId), listRecipes(familyId)]);
  const canWrite = canWriteContent(vault.role);
  const canManage = canManageMembers(vault.role);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const recipeOptions = recipes.map((recipe) => ({ id: recipe.id, title: recipe.title }));

  return (
    <PageShell
      title={t("moments.title")}
      eyebrow={vault.name}
      actions={
        canWrite && recipes.length > 0 ? (
          <CookedSheet familyId={familyId} recipes={recipeOptions} />
        ) : undefined
      }
    >
      {moments.length === 0 ? (
        <EmptyState
          icon={<Camera />}
          title={t("moments.emptyTitle")}
          body={recipes.length > 0 || !canWrite ? t("moments.emptyBody") : t("moments.noRecipes")}
          action={
            canWrite && recipes.length === 0 ? (
              <ButtonLink href={`/vault/${familyId}/recipes/new`}>
                {t("ui.firstRecipe.emptyAction")}
              </ButtonLink>
            ) : canWrite ? (
              <CookedSheet familyId={familyId} recipes={recipeOptions} />
            ) : (
              <ButtonLink href={`/vault/${familyId}`}>{t("moments.emptyAction")}</ButtonLink>
            )
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {moments.map((moment) => (
            <li key={moment.id}>
              <MomentCard
                authorName={moment.authorName}
                byline={t("moments.cookedBy", { name: moment.authorName })}
                dateText={date.format(new Date(moment.cookedOn))}
                recipeTitle={moment.recipeTitle}
                rating={moment.rating}
                ratingLabel={
                  moment.rating === null ? "" : t("sample.rating", { count: moment.rating })
                }
                note={moment.note}
                photoUrl={moment.photoUrl}
                photoAlt={moment.recipeTitle}
                action={
                  moment.authorId === vault.userId || canManage ? (
                    <ActionButton
                      action={removeMoment.bind(null, familyId, moment.id)}
                      label={t("moments.remove")}
                      confirm={t("moments.removeConfirm")}
                      kind="secondary"
                    />
                  ) : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
