"use client";

import {
  blankDraft,
  blankIngredient,
  blankLine,
  contentFromDraft,
  type DraftErrors,
  draftFromRecipe,
  type DraftIngredient,
  type DraftLine,
  type Language,
  LanguageSchema,
  type RecipeDraft,
  type StructuredRecipe,
} from "@virasat/core";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { Button, Field, Notice, Select, TextArea, TextInput } from "@/components/ui.tsx";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { confirmReview } from "./actions.ts";

type Props = {
  familyId: string;
  jobId: string;
  /** The computer's draft. Null for a capture that failed: the form opens empty. */
  recipe: StructuredRecipe | null;
  /** Parts of the draft the pipeline could not trace to the source. */
  flagged: string[];
  language: Language;
  /** For a capture that failed: its words go in the first step to be split up by hand. */
  transcript: string | null;
};

function initialDraft({ recipe, flagged, language, transcript }: Props): RecipeDraft {
  if (recipe) return draftFromRecipe(recipe, flagged);
  const draft = blankDraft(language);
  const [firstStep] = draft.steps;
  if (transcript && firstStep) firstStep.text = transcript;
  return draft;
}

/** Marks a part of the draft the computer was unsure about, so it is looked at, not skimmed. */
function Check({ flagged, children }: { flagged: boolean; children: ReactNode }) {
  const t = useT();
  if (!flagged) return <>{children}</>;
  return (
    <div className="flex flex-col gap-1 rounded-lg border-2 border-accent p-2" data-flagged="true">
      <span className="text-sm font-semibold text-accent">{t("review.check")}</span>
      {children}
    </div>
  );
}

export function ReviewForm(props: Props) {
  const { familyId, jobId, recipe } = props;
  const t = useT();
  const message = useMessage();
  const router = useRouter();
  const [draft, setDraft] = useState<RecipeDraft>(() => initialDraft(props));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const error = (key: string) => {
    const code = errors[key];
    return code ? message(`review.errors.${code}`) : undefined;
  };

  const change = (patch: Partial<RecipeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };
  const changeIngredient = (key: string, patch: Partial<DraftIngredient>) => {
    change({
      ingredients: draft.ingredients.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    });
  };
  const changeLines = (field: "steps" | "tips", key: string, text: string) => {
    change({ [field]: draft[field].map((line) => (line.key === key ? { ...line, text } : line)) });
  };
  const removeLine = (field: "steps" | "tips", key: string) => {
    change({ [field]: draft[field].filter((line) => line.key !== key) });
  };

  const toCheck =
    Number(draft.titleFlagged) +
    Number(draft.servingsFlagged) +
    Number(draft.storyFlagged) +
    draft.ingredients.filter((row) => row.flags.length > 0).length +
    [...draft.steps, ...draft.tips].filter((line) => line.flagged).length;

  function save() {
    setServerError(null);
    const result = contentFromDraft(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    startSaving(async () => {
      const outcome = await confirmReview(familyId, jobId, result.content);
      if (outcome.status === "error") {
        setServerError(outcome.message ?? "errors.generic");
        return;
      }
      router.replace(`/vault/${familyId}/captures/${jobId}`);
      router.refresh();
    });
  }

  const fieldIsFlagged = (row: DraftIngredient, field: DraftIngredient["flags"][number]) =>
    row.flags.includes(field);

  return (
    <form
      className="flex flex-col gap-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {toCheck > 0 && (
        <Notice kind="success">
          <span data-testid="to-check">{t("review.toCheck", { count: toCheck })}</span>
        </Notice>
      )}
      {!recipe && <p className="text-muted">{t("review.manualHint")}</p>}

      <section className="flex flex-col gap-4">
        <Check flagged={draft.titleFlagged}>
          <Field label={t("review.titleLabel")} error={error("title")}>
            <TextInput
              value={draft.title}
              aria-invalid={Boolean(errors["title"])}
              onChange={(event) => {
                change({ title: event.target.value, titleFlagged: false });
              }}
            />
          </Field>
        </Check>
        <div className="grid gap-4 sm:grid-cols-2">
          <Check flagged={draft.servingsFlagged}>
            <Field
              label={t("review.servingsLabel")}
              optional={t("person.optional")}
              error={error("servings")}
            >
              <TextInput
                inputMode="numeric"
                value={draft.servings}
                aria-invalid={Boolean(errors["servings"])}
                onChange={(event) => {
                  change({ servings: event.target.value, servingsFlagged: false });
                }}
              />
            </Field>
          </Check>
          <Field label={t("review.languageLabel")}>
            <Select
              value={draft.language}
              onChange={(event) => {
                change({ language: event.target.value as Language });
              }}
            >
              {LanguageSchema.options.map((code) => (
                <option key={code} value={code}>
                  {t(`languages.${code}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl">{t("review.ingredients")}</h2>
        <p className="text-muted">{t("review.ingredientsHint")}</p>
        {error("ingredients") && (
          <p role="alert" className="font-medium text-danger">
            {error("ingredients")}
          </p>
        )}
        <ul className="flex flex-col gap-4">
          {draft.ingredients.map((row, index) => (
            <li
              key={row.key}
              className="flex flex-col gap-3 rounded-lg bg-surface p-4"
              data-testid="ingredient"
            >
              <Check flagged={fieldIsFlagged(row, "original_text")}>
                <Field
                  label={t("review.originalWords", { n: index + 1 })}
                  hint={t("review.originalHint")}
                  error={error(`ingredient.${row.key}.originalText`)}
                >
                  <TextInput
                    value={row.originalText}
                    aria-invalid={Boolean(errors[`ingredient.${row.key}.originalText`])}
                    onChange={(event) => {
                      changeIngredient(row.key, { originalText: event.target.value });
                    }}
                  />
                </Field>
              </Check>
              <div className="grid gap-3 sm:grid-cols-2">
                <Check flagged={fieldIsFlagged(row, "name")}>
                  <Field label={t("review.ingredientName")} optional={t("person.optional")}>
                    <TextInput
                      value={row.name}
                      onChange={(event) => {
                        changeIngredient(row.key, { name: event.target.value });
                      }}
                    />
                  </Field>
                </Check>
                <Check flagged={fieldIsFlagged(row, "note")}>
                  <Field label={t("review.note")} optional={t("person.optional")}>
                    <TextInput
                      value={row.note}
                      onChange={(event) => {
                        changeIngredient(row.key, { note: event.target.value });
                      }}
                    />
                  </Field>
                </Check>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Check flagged={fieldIsFlagged(row, "quantity")}>
                  <Field
                    label={t("review.suggestedAmount")}
                    hint={t("review.suggestedHint")}
                    optional={t("person.optional")}
                    error={error(`ingredient.${row.key}.quantity`)}
                  >
                    <TextInput
                      inputMode="decimal"
                      value={row.quantity}
                      aria-invalid={Boolean(errors[`ingredient.${row.key}.quantity`])}
                      onChange={(event) => {
                        changeIngredient(row.key, {
                          quantity: event.target.value,
                          confidence: null,
                        });
                      }}
                    />
                  </Field>
                </Check>
                <Check flagged={fieldIsFlagged(row, "unit")}>
                  <Field label={t("review.unit")} optional={t("person.optional")}>
                    <TextInput
                      value={row.unit}
                      onChange={(event) => {
                        changeIngredient(row.key, { unit: event.target.value, confidence: null });
                      }}
                    />
                  </Field>
                </Check>
              </div>
              <Button
                kind="quiet"
                className="self-start"
                onClick={() => {
                  change({ ingredients: draft.ingredients.filter((item) => item.key !== row.key) });
                }}
              >
                {t("review.removeIngredient", { n: index + 1 })}
              </Button>
            </li>
          ))}
        </ul>
        <Button
          kind="secondary"
          className="self-start"
          onClick={() => {
            change({ ingredients: [...draft.ingredients, blankIngredient()] });
          }}
        >
          {t("review.addIngredient")}
        </Button>
      </section>

      <LineList
        title={t("review.steps")}
        error={error("steps")}
        lines={draft.steps}
        label={(n) => t("review.stepLabel", { n })}
        removeLabel={(n) => t("review.removeStep", { n })}
        addLabel={t("review.addStep")}
        multiline
        onChange={(key, text) => {
          changeLines("steps", key, text);
        }}
        onRemove={(key) => {
          removeLine("steps", key);
        }}
        onAdd={() => {
          change({ steps: [...draft.steps, blankLine()] });
        }}
      />

      <LineList
        title={t("review.tips")}
        lines={draft.tips}
        label={(n) => t("review.tipLabel", { n })}
        removeLabel={(n) => t("review.removeTip", { n })}
        addLabel={t("review.addTip")}
        onChange={(key, text) => {
          changeLines("tips", key, text);
        }}
        onRemove={(key) => {
          removeLine("tips", key);
        }}
        onAdd={() => {
          change({ tips: [...draft.tips, blankLine()] });
        }}
      />

      <section className="flex flex-col gap-4">
        <Check flagged={draft.storyFlagged}>
          <Field
            label={t("review.story")}
            hint={t("review.storyHint")}
            optional={t("person.optional")}
          >
            <TextArea
              rows={5}
              value={draft.story}
              onChange={(event) => {
                change({ story: event.target.value, storyFlagged: false });
              }}
            />
          </Field>
        </Check>
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        {errors["form"] && (
          <Notice kind="error">{message(`review.errors.${errors["form"]}`)}</Notice>
        )}
        {Object.keys(errors).length > 0 && !errors["form"] && (
          <Notice kind="error">{t("review.fixErrors")}</Notice>
        )}
        {serverError && <Notice kind="error">{message(serverError)}</Notice>}
        <p className="text-muted">{t("review.saveNote")}</p>
        <Button type="submit" disabled={saving} className="self-start">
          {t(saving ? "review.saving" : "review.save")}
        </Button>
      </section>
    </form>
  );
}

function LineList({
  title,
  error,
  lines,
  label,
  removeLabel,
  addLabel,
  multiline = false,
  onChange,
  onRemove,
  onAdd,
}: {
  title: string;
  error?: string | undefined;
  lines: DraftLine[];
  label: (n: number) => string;
  removeLabel: (n: number) => string;
  addLabel: string;
  multiline?: boolean;
  onChange: (key: string, text: string) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl">{title}</h2>
      {error && (
        <p role="alert" className="font-medium text-danger">
          {error}
        </p>
      )}
      <ol className="flex flex-col gap-4">
        {lines.map((line, index) => (
          <li key={line.key} className="flex flex-col gap-2">
            <Check flagged={line.flagged}>
              <Field label={label(index + 1)}>
                {multiline ? (
                  <TextArea
                    rows={3}
                    value={line.text}
                    onChange={(event) => {
                      onChange(line.key, event.target.value);
                    }}
                  />
                ) : (
                  <TextInput
                    value={line.text}
                    onChange={(event) => {
                      onChange(line.key, event.target.value);
                    }}
                  />
                )}
              </Field>
            </Check>
            <Button
              kind="quiet"
              className="self-start"
              onClick={() => {
                onRemove(line.key);
              }}
            >
              {removeLabel(index + 1)}
            </Button>
          </li>
        ))}
      </ol>
      <Button kind="secondary" className="self-start" onClick={onAdd}>
        {addLabel}
      </Button>
    </section>
  );
}
