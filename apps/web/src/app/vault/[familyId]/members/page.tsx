import { canManageMembers, type FamilyRole } from "@virasat/core";
import type { Metadata } from "next";
import { ActionButton } from "@/components/action-button.tsx";
import { Avatar, ButtonLink, PageShell, Section } from "@/components/ui.tsx";
import { getVault, listMembers, listPendingInvites } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { removeMember, revokeInvite } from "../actions.ts";
import { RoleForm } from "./role-form.tsx";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("members.title") };
}

/** Mirrors the RLS policy: owners manage everyone; admins manage members and viewers. */
function assignableRoles(myRole: FamilyRole, targetRole: FamilyRole): FamilyRole[] {
  if (myRole === "owner") return ["owner", "admin", "member", "viewer"];
  if (myRole === "admin" && (targetRole === "member" || targetRole === "viewer")) {
    return ["admin", "member", "viewer"];
  }
  return [];
}

export default async function MembersPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t, locale }] = await Promise.all([getVault(familyId), getT()]);
  const canManage = canManageMembers(vault.role);
  const [members, invites] = await Promise.all([
    listMembers(familyId),
    canManage ? listPendingInvites(familyId) : Promise.resolve([]),
  ]);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <PageShell title={t("members.title")} back={{ href: `/vault/${familyId}`, label: vault.name }}>
      <ul className="flex flex-col gap-3">
        {members.map((member) => {
          const isMe = member.profileId === vault.userId;
          const roles = isMe ? [] : assignableRoles(vault.role, member.role);
          return (
            <li
              key={member.profileId}
              className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-4 shadow-album ring-1 ring-border ring-inset"
            >
              <Avatar name={member.displayName} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-lg font-semibold">
                  {member.displayName}
                  {isMe && (
                    <span className="ms-2 text-sm font-normal text-muted">
                      ({t("members.you")})
                    </span>
                  )}
                </span>
                {roles.length === 0 && (
                  <span className="text-muted">{t(`roles.${member.role}`)}</span>
                )}
              </div>
              {roles.length > 0 && (
                <RoleForm
                  familyId={familyId}
                  profileId={member.profileId}
                  current={member.role}
                  options={roles.map((role) => ({ value: role, label: t(`roles.${role}`) }))}
                />
              )}
              {roles.length > 0 && (
                <ActionButton
                  action={removeMember.bind(null, familyId, member.profileId)}
                  label={t("members.remove")}
                  confirm={`${t("members.remove")}: ${member.displayName}?`}
                />
              )}
            </li>
          );
        })}
      </ul>

      {canManage && (
        <Section
          title={t("members.pendingInvites")}
          action={
            <ButtonLink href={`/vault/${familyId}/invite`} kind="secondary">
              {t("vault.invite")}
            </ButtonLink>
          }
        >
          {invites.length === 0 ? (
            <p className="text-muted">{t("members.noPending")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface p-4 shadow-album ring-1 ring-border ring-inset"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {invite.phone ?? invite.email ?? t("members.inviteByLink")}
                    </span>
                    <span className="text-sm text-muted">
                      {t(`roles.${invite.role}`)} ·{" "}
                      {t("members.expires", { date: date.format(new Date(invite.expires_at)) })}
                    </span>
                  </span>
                  <ActionButton
                    action={revokeInvite.bind(null, familyId, invite.id)}
                    label={t("members.revoke")}
                    kind="secondary"
                  />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <div className="border-t border-border pt-6">
        <ActionButton
          action={removeMember.bind(null, familyId, vault.userId)}
          label={t("members.leave")}
          confirm={t("members.leaveConfirm", { vault: vault.name })}
        />
      </div>
    </PageShell>
  );
}
