"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button.tsx";
import { Notice } from "@/components/ui.tsx";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { addPerson } from "../../actions.ts";
import { PersonFields } from "../person-fields.tsx";

export function AddPersonForm({ familyId }: { familyId: string }) {
  const t = useT();
  const message = useMessage();
  const [state, action] = useActionState(addPerson.bind(null, familyId), idle);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.status === "error" && state.message && (
        <Notice kind="error">{message(state.message)}</Notice>
      )}
      <PersonFields
        errors={state.status === "error" ? state.fieldErrors : undefined}
        submitted={state.status === "error" ? state.values : undefined}
      />
      <SubmitButton>{t("person.add")}</SubmitButton>
    </form>
  );
}
