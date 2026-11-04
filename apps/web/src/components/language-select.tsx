"use client";

/** Language picker. With submitOnChange it submits its form as soon as a language is picked. */
export function LanguageSelect({
  name,
  defaultValue,
  label,
  options,
  submitOnChange = false,
}: {
  name: string;
  defaultValue: string;
  label: string;
  options: { value: string; label: string }[];
  submitOnChange?: boolean;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      aria-label={label}
      className="min-h-tap-target rounded-md border-2 border-outline bg-surface px-2"
      onChange={(event) => {
        if (submitOnChange) event.currentTarget.form?.requestSubmit();
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} lang={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
