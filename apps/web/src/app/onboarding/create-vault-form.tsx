"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button.tsx";
import { Field, Notice, TextInput } from "@/components/ui.tsx";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { createVault } from "./actions.ts";

export function CreateVaultForm() {
  const t = useT();
  const message = useMessage();
  const [state, action] = useActionState(createVault, idle);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.status === "error" && state.message && (
        <Notice kind="error">{message(state.message)}</Notice>
      )}
      <Field label={t("onboarding.nameLabel")} error={errors?.name && message(errors.name)}>
        <TextInput
          name="name"
          required
          maxLength={80}
          placeholder={t("onboarding.namePlaceholder")}
          defaultValue={state.status === "error" ? (state.values?.name ?? "") : ""}
          aria-invalid={Boolean(errors?.name)}
          autoFocus
        />
      </Field>
      <SubmitButton>{t("onboarding.create")}</SubmitButton>
    </form>
  );
}
