import { canManageMembers, canWriteContent } from "@virasat/core";
import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button.tsx";
import { Avatar, ButtonLink, PageShell, Section } from "@/components/ui.tsx";
import { getPerson, getVault, listRecordingLinks } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { removePerson, revokeRecordingLink } from "../../actions.ts";
import { EditPersonForm } from "./edit-person-form.tsx";
import { PhotoPicker } from "./photo-picker.tsx";
import { RecordingLinkForm } from "./recording-link-form.tsx";

type Props = { params: Promise<{ familyId: string; personId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { familyId, personId } = await params;
  await getVault(familyId);
  const person = await getPerson(familyId, personId);
  return { title: person.relation_label ?? person.display_name };
}

export default async function PersonPage({ params }: Props) {
  const { familyId, personId } = await params;
  const [vault, { t, locale }] = await Promise.all([getVault(familyId), getT()]);
  const person = await getPerson(familyId, personId);
  const canWrite = canWriteContent(vault.role);
  const canManage = canManageMembers(vault.role);
  const heading = person.relation_label ?? person.display_name;
  const links = canWrite ? await listRecordingLinks(personId) : [];
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <PageShell title={heading} back={{ href: `/vault/${familyId}`, label: vault.name }}>
      <div className="-mt-4 flex items-center gap-5">
        <Avatar name={heading} photoUrl={person.photoUrl} size="lg" />
        <div className="flex flex-col gap-1">
          {person.relation_label && <span className="text-lg">{person.display_name}</span>}
          {person.birth_year && (
            <span className="text-muted">{t("person.born", { year: person.birth_year })}</span>
          )}
          <span className="text-muted">
            {person.profile_id ? t("vault.hasJoined") : t("vault.notJoined")}
          </span>
          {canWrite && (
            <PhotoPicker
              familyId={familyId}
              personId={personId}
              label={t(person.photo_path ? "person.changePhoto" : "person.choosePhoto")}
            />
          )}
        </div>
      </div>

      {canManage && !person.profile_id && (
        <ButtonLink
          href={`/vault/${familyId}/invite?person=${personId}`}
          kind="secondary"
          className="self-start"
        >
          {t("person.inviteToJoin", { name: heading })}
        </ButtonLink>
      )}

      {canWrite && (
        <Section title={t("capture.sectionTitle")}>
          <p className="text-muted">{t("capture.sectionIntro", { name: heading })}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/vault/${familyId}/people/${personId}/capture`}>
              {t("capture.recordAction", { name: heading })}
            </ButtonLink>
            <ButtonLink
              href={`/vault/${familyId}/people/${personId}/capture?mode=pages`}
              kind="secondary"
            >
              {t("capture.pagesAction")}
            </ButtonLink>
          </div>
        </Section>
      )}

      {canWrite && (
        <Section title={t("recordingLinks.title")}>
          <p className="text-muted">{t("recordingLinks.intro", { name: heading })}</p>
          <RecordingLinkForm familyId={familyId} personId={personId} name={heading} />
          {links.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-semibold">{t("recordingLinks.activeTitle")}</h3>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 shadow-album ring-1 ring-border ring-inset"
                  >
                    <span className="flex flex-col text-sm text-muted">
                      <span>
                        {t("recordingLinks.left", { left: link.max_uploads - link.upload_count })}
                      </span>
                      <span>
                        {t("recordingLinks.until", {
                          date: dateFormat.format(new Date(link.expires_at)),
                        })}
                      </span>
                    </span>
                    <ActionButton
                      action={revokeRecordingLink.bind(null, familyId, personId, link.id)}
                      label={t("recordingLinks.stop")}
                      confirm={t("recordingLinks.stopConfirm")}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {canWrite ? (
        <Section title={t("person.edit")}>
          <EditPersonForm familyId={familyId} person={person} />
        </Section>
      ) : (
        person.notes && (
          <p className="text-lg leading-relaxed whitespace-pre-line">{person.notes}</p>
        )
      )}

      {canManage && (
        <div className="border-t border-border pt-6">
          <ActionButton
            action={removePerson.bind(null, familyId, personId)}
            label={t("person.remove")}
            confirm={t("person.removeConfirm", { name: heading })}
          />
        </div>
      )}
    </PageShell>
  );
}
