"use client";

import { ConfirmMoment } from "@virasat/ui/confirm-moment";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button.tsx";
import {
  Button,
  ButtonLink,
  Field,
  Notice,
  Select,
  TextArea,
  TextInput,
} from "@/components/ui.tsx";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { createTypedRecipe, type TypedRecipeSaved } from "./actions.ts";

export type PersonOption = { id: string; label: string };

/** The two-minute first recipe: typed from memory, in the cook's own words. */
export function TypedRecipeForm(props: { familyId: string; people: PersonOption[] }) {
  // Each "add another" starts a fresh form, with its own result state.
  const [round, setRound] = useState(0);
  return (
    <RecipeFormRound
      key={round}
      {...props}
      onAnother={() => {
        setRound(round + 1);
      }}
    />
  );
}

function RecipeFormRound({
  familyId,
  people,
  onAnother,
}: {
  familyId: string;
  people: PersonOption[];
  onAnother: () => void;
}) {
  const t = useT();
  const message = useMessage();
  const [state, action] = useActionState(createTypedRecipe.bind(null, familyId), idle);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const error = (field: string) => (errors?.[field] ? message(errors[field]) : undefined);

  if (state.status === "success" && state.data) {
    const saved: TypedRecipeSaved = state.data;
    return (
      <ConfirmMoment title={t("ui.firstRecipe.savedTitle")}>
        <p className="max-w-prose text-lg text-muted">
          {t("ui.firstRecipe.savedBody", { title: saved.title })}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/vault/${familyId}`}>{t("ui.firstRecipe.toVault")}</ButtonLink>
          <Button kind="secondary" onClick={onAnother}>
            {t("ui.firstRecipe.addAnother")}
          </Button>
        </div>
      </ConfirmMoment>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.status === "error" && state.message && (
        <Notice kind="error">{message(state.message)}</Notice>
      )}
      <Field label={t("ui.firstRecipe.titleLabel")} error={error("title")}>
        <TextInput
          name="title"
          required
          maxLength={200}
          placeholder={t("ui.firstRecipe.titlePlaceholder")}
          defaultValue={values["title"] ?? ""}
          aria-invalid={Boolean(errors?.["title"])}
          autoFocus
        />
      </Field>
      <Field
        label={t("ui.firstRecipe.ingredientsLabel")}
        hint={t("ui.firstRecipe.ingredientsHint")}
        error={error("ingredients")}
      >
        <TextArea
          name="ingredients"
          required
          rows={6}
          placeholder={t("ui.firstRecipe.ingredientsPlaceholder")}
          defaultValue={values["ingredients"] ?? ""}
          aria-invalid={Boolean(errors?.["ingredients"])}
        />
      </Field>
      <Field
        label={t("ui.firstRecipe.stepsLabel")}
        optional={t("person.optional")}
        hint={t("ui.firstRecipe.stepsHint")}
        error={error("steps")}
      >
        <TextArea name="steps" rows={5} defaultValue={values["steps"] ?? ""} />
      </Field>
      <Field
        label={t("ui.firstRecipe.storyLabel")}
        optional={t("person.optional")}
        hint={t("ui.firstRecipe.storyHint")}
        error={error("story")}
      >
        <TextArea name="story" rows={3} defaultValue={values["story"] ?? ""} />
      </Field>
      {people.length > 0 && (
        <Field label={t("ui.firstRecipe.personLabel")} optional={t("person.optional")}>
          <Select name="originPerson" defaultValue={values["originPerson"] ?? ""}>
            <option value="">{t("ui.firstRecipe.personNone")}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <SubmitButton>{t("ui.firstRecipe.save")}</SubmitButton>
    </form>
  );
}
