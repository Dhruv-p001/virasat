"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button.tsx";
import { Field, Notice, Select, TextInput } from "@/components/ui.tsx";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { updateProfile } from "./actions.ts";

const UNIT_SYSTEMS = ["metric", "us_customary", "cups_spoons"] as const;

export function ProfileForm({
  profile,
  languages,
  countries,
}: {
  profile: {
    display_name: string;
    preferred_language: string;
    unit_system: (typeof UNIT_SYSTEMS)[number];
    country_code: string | null;
  };
  languages: { value: string; label: string }[];
  countries: { value: string; label: string }[];
}) {
  const t = useT();
  const message = useMessage();
  const [state, action] = useActionState(updateProfile, idle);
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const submitted = state.status === "error" ? state.values : undefined;
  const value = (key: string, saved: string) => submitted?.[key] ?? saved;

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.status === "error" && state.message && (
        <Notice kind="error">{message(state.message)}</Notice>
      )}
      {state.status === "success" && <Notice kind="success">{t("settings.saved")}</Notice>}

      <Field
        label={t("settings.displayNameLabel")}
        error={errors?.displayName && message(errors.displayName)}
      >
        <TextInput
          name="displayName"
          required
          maxLength={80}
          autoComplete="name"
          defaultValue={value("displayName", profile.display_name)}
          aria-invalid={Boolean(errors?.displayName)}
        />
      </Field>

      <Field label={t("settings.language")}>
        <Select
          name="preferredLanguage"
          defaultValue={value("preferredLanguage", profile.preferred_language)}
        >
          {languages.map((language) => (
            <option key={language.value} value={language.value} lang={language.value}>
              {language.label}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-medium">{t("settings.units")}</legend>
        <p className="mb-2 text-sm text-muted">{t("settings.unitsHelp")}</p>
        {UNIT_SYSTEMS.map((system) => (
          <label key={system} className="flex min-h-tap-target cursor-pointer items-center gap-3">
            <input
              type="radio"
              name="unitSystem"
              value={system}
              defaultChecked={value("unitSystem", profile.unit_system) === system}
              className="size-5 accent-[var(--color-accent)]"
            />
            {t(`settings.units_${system}`)}
          </label>
        ))}
      </fieldset>

      <Field
        label={t("settings.country")}
        error={errors?.countryCode && message(errors.countryCode)}
      >
        <Select name="countryCode" defaultValue={value("countryCode", profile.country_code ?? "")}>
          <option value="">{t("settings.countryNone")}</option>
          {countries.map((country) => (
            <option key={country.value} value={country.value}>
              {country.label}
            </option>
          ))}
        </Select>
      </Field>

      <SubmitButton>{t("settings.save")}</SubmitButton>
    </form>
  );
}
