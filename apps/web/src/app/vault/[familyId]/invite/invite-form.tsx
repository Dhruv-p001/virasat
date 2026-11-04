"use client";

import type { Language } from "@virasat/core";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button.tsx";
import { Button, Field, Notice, Select, TextInput } from "@/components/ui.tsx";
import { type ActionState, idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { type CreatedInvite, createInvite } from "../actions.ts";

type Channel = "link" | "phone" | "email";
const CHANNELS: Channel[] = ["link", "phone", "email"];
const ROLES = ["member", "viewer", "admin"] as const;

export function InviteForm(props: {
  familyId: string;
  locale: Language;
  people: { id: string; label: string }[];
  preselectedPersonId: string;
}) {
  // A new key gives a fresh form after "Create another invite".
  const [round, setRound] = useState(0);
  return (
    <InviteFormRound
      key={round}
      {...props}
      onAnother={() => {
        setRound((n) => n + 1);
      }}
    />
  );
}

function InviteFormRound({
  familyId,
  locale,
  people,
  preselectedPersonId,
  onAnother,
}: {
  familyId: string;
  locale: Language;
  people: { id: string; label: string }[];
  preselectedPersonId: string;
  onAnother: () => void;
}) {
  const t = useT();
  const message = useMessage();
  const [state, action] = useActionState<ActionState<CreatedInvite>, FormData>(
    createInvite.bind(null, familyId),
    idle,
  );
  const submitted = state.status === "error" ? state.values : undefined;
  const [channel, setChannel] = useState<Channel>(
    (submitted?.channel as Channel | undefined) ?? "link",
  );

  if (state.status === "success" && state.data) {
    return <InviteReady invite={state.data} locale={locale} onAnother={onAnother} />;
  }

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const channelLabel = {
    link: t("invite.channelLink"),
    phone: t("invite.channelPhone"),
    email: t("invite.channelEmail"),
  };
  const channelHelp = {
    link: t("invite.channelLinkHelp"),
    phone: t("invite.channelPhoneHelp"),
    email: t("invite.channelEmailHelp"),
  };

  return (
    <form action={action} className="flex flex-col gap-8">
      {state.status === "error" && state.message && (
        <Notice kind="error">{message(state.message)}</Notice>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">{t("invite.how")}</legend>
        {CHANNELS.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface p-4 has-checked:outline-2 has-checked:outline-accent"
          >
            <input
              type="radio"
              name="channel"
              value={option}
              checked={channel === option}
              onChange={() => {
                setChannel(option);
              }}
              className="mt-1 size-5 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{channelLabel[option]}</span>
              <span className="text-muted">{channelHelp[option]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {channel === "phone" && (
        <Field
          label={t("invite.phoneLabel")}
          hint={t("signIn.phoneHint")}
          error={errors?.phone && message(errors.phone)}
        >
          <TextInput
            name="phone"
            type="tel"
            autoComplete="off"
            required
            placeholder="+91 98765 43210"
            defaultValue={submitted?.phone ?? ""}
            aria-invalid={Boolean(errors?.phone)}
          />
        </Field>
      )}
      {channel === "email" && (
        <Field label={t("invite.emailLabel")} error={errors?.email && message(errors.email)}>
          <TextInput
            name="email"
            type="email"
            autoComplete="off"
            required
            defaultValue={submitted?.email ?? ""}
            aria-invalid={Boolean(errors?.email)}
          />
        </Field>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-lg font-semibold">{t("invite.role")}</legend>
        {ROLES.map((role) => (
          <label
            key={role}
            className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface p-4 has-checked:outline-2 has-checked:outline-accent"
          >
            <input
              type="radio"
              name="role"
              value={role}
              defaultChecked={(submitted?.role ?? "member") === role}
              className="mt-1 size-5 accent-[var(--color-accent)]"
            />
            <span className="flex flex-col">
              <span className="font-semibold">{t(`roles.${role}`)}</span>
              <span className="text-muted">{t(`roles.${role}Help`)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {people.length > 0 && (
        <Field label={t("invite.forPerson")} hint={t("invite.forPersonHelp")}>
          <Select name="personId" defaultValue={submitted?.personId ?? preselectedPersonId}>
            <option value="">{t("invite.forPersonNone")}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <SubmitButton>{t("invite.create")}</SubmitButton>
    </form>
  );
}

function InviteReady({
  invite,
  locale,
  onAnother,
}: {
  invite: CreatedInvite;
  locale: Language;
  onAnother: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const expires = invite.expiresAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(invite.expiresAt))
    : "";
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(t("invite.whatsappText", { url: invite.url }))}`;

  return (
    <div className="flex flex-col gap-5 rounded-lg bg-surface p-5">
      <h2 className="text-xl">{t("invite.readyTitle")}</h2>
      <p className="text-muted">{t("invite.readyBody", { date: expires })}</p>
      <input
        readOnly
        value={invite.url}
        aria-label={t("invite.readyTitle")}
        data-testid="invite-url"
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        className="min-h-tap-target w-full rounded-md border-2 border-outline bg-paper px-3 font-mono text-sm"
      />
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(invite.url).then(() => {
              setCopied(true);
            });
          }}
        >
          {copied ? t("invite.copied") : t("invite.copy")}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-tap-target items-center justify-center rounded-full border-2 border-outline px-5 font-semibold"
        >
          {t("invite.shareWhatsApp")}
        </a>
      </div>
      <Button kind="quiet" className="self-start px-0" onClick={onAnother}>
        {t("invite.another")}
      </Button>
    </div>
  );
}
