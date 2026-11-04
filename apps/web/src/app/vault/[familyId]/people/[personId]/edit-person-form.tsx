"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button.tsx";
import { Notice } from "@/components/ui.tsx";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { updatePerson } from "../../actions.ts";
import { PersonFields } from "../person-fields.tsx";

export function EditPersonForm({
  familyId,
  person,
}: {
  familyId: string;
  person: {
    id: string;
    display_name: string;
    relation_label: string | null;
    birth_year: number | null;
    notes: string | null;
  };
}) {
  const t = useT();
  const message = useMessage();
  const [state, action] = useActionState(updatePerson.bind(null, familyId, person.id), idle);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.status === "error" && state.message && (
        <Notice kind="error">{message(state.message)}</Notice>
      )}
      {state.status === "success" && <Notice kind="success">{t("settings.saved")}</Notice>}
      <PersonFields
        values={person}
        errors={state.status === "error" ? state.fieldErrors : undefined}
        submitted={state.status === "error" ? state.values : undefined}
      />
      <SubmitButton>{t("person.save")}</SubmitButton>
    </form>
  );
}
