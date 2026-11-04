import { canManageMembers, canWriteContent } from "@virasat/core";
import type { Metadata } from "next";
import Link from "next/link";
import { AiModeBanner } from "@/components/ai-mode-banner.tsx";
import { CaptureList } from "@/components/capture-list.tsx";
import { Avatar, ButtonLink, EmptyState, PageShell, Section } from "@/components/ui.tsx";
import { getVault, listOpenCaptures, listPeople } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const vault = await getVault((await params).familyId);
  return { title: vault.name };
}

export default async function VaultPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  const canWrite = canWriteContent(vault.role);
  const [people, captures] = await Promise.all([
    listPeople(familyId),
    canWrite ? listOpenCaptures(familyId, 5) : Promise.resolve([]),
  ]);

  return (
    <PageShell
      title={vault.name}
      actions={
        canManageMembers(vault.role) ? (
          <ButtonLink href={`/vault/${familyId}/invite`} kind="secondary">
            {t("vault.invite")}
          </ButtonLink>
        ) : undefined
      }
    >
      <p className="-mt-6 text-muted">{t("vault.yourRole", { role: t(`roles.${vault.role}`) })}</p>

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
          <CaptureList captures={captures} />
        </Section>
      )}

      <Section
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
          <ul className="grid gap-3 sm:grid-cols-2">
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  href={`/vault/${familyId}/people/${person.id}`}
                  className="flex items-center gap-4 rounded-lg bg-surface p-4"
                >
                  <Avatar
                    name={person.relation_label ?? person.display_name}
                    photoUrl={person.photoUrl}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-lg font-semibold">
                      {person.relation_label ?? person.display_name}
                    </span>
                    <span className="truncate text-muted">
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
        className="self-start text-accent underline underline-offset-4"
      >
        {t("vault.members")}
      </Link>
    </PageShell>
  );
}
