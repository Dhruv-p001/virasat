"use client";

import { Field, TextArea, TextInput } from "@/components/ui.tsx";
import { useMessage, useT } from "@/lib/i18n/client.tsx";

type PersonValues = {
  display_name?: string;
  relation_label?: string | null;
  birth_year?: number | null;
  notes?: string | null;
};

/** The person form's fields, shared by "add" and "edit". */
export function PersonFields({
  values: saved = {},
  submitted,
  errors,
  disabled = false,
}: {
  values?: PersonValues;
  /** What was typed in a submission that failed, so the fields keep it. */
  submitted?: Record<string, string> | undefined;
  errors?: Record<string, string> | undefined;
  disabled?: boolean;
}) {
  const t = useT();
  const message = useMessage();
  const error = (field: string) => (errors?.[field] ? message(errors[field]) : undefined);
  const values: PersonValues = submitted
    ? {
        display_name: submitted.displayName ?? "",
        relation_label: submitted.relationLabel ?? "",
        birth_year: submitted.birthYear ? Number(submitted.birthYear) || null : null,
        notes: submitted.notes ?? "",
      }
    : saved;

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      <Field
        label={t("person.relationLabel")}
        hint={t("person.relationHint")}
        optional={t("person.optional")}
        error={error("relationLabel")}
      >
        <TextInput
          name="relationLabel"
          maxLength={40}
          defaultValue={values.relation_label ?? ""}
          aria-invalid={Boolean(errors?.relationLabel)}
        />
      </Field>
      <Field label={t("person.nameLabel")} hint={t("person.nameHint")} error={error("displayName")}>
        <TextInput
          name="displayName"
          required
          maxLength={80}
          defaultValue={values.display_name ?? ""}
          aria-invalid={Boolean(errors?.displayName)}
        />
      </Field>
      <Field
        label={t("person.birthYearLabel")}
        optional={t("person.optional")}
        error={error("birthYear")}
      >
        <TextInput
          name="birthYear"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          className="min-h-tap-target w-32 rounded-md border-2 border-outline bg-surface px-3 text-lg"
          defaultValue={values.birth_year ?? ""}
          aria-invalid={Boolean(errors?.birthYear)}
        />
      </Field>
      <Field
        label={t("person.notesLabel")}
        hint={t("person.notesHint")}
        optional={t("person.optional")}
        error={error("notes")}
      >
        <TextArea
          name="notes"
          maxLength={2000}
          defaultValue={values.notes ?? ""}
          aria-invalid={Boolean(errors?.notes)}
        />
      </Field>
    </fieldset>
  );
}
