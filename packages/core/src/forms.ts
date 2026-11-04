import { z } from "zod";
import { isCountryCode } from "./countries.ts";
import { LanguageSchema } from "./enums.ts";

// Form inputs, validated in server actions before they reach the database (which validates
// again). Error messages are i18n keys, so the UI shows them in the reader's language.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "errors.tooLong")
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const requiredText = (max: number) =>
  z.string("errors.required").trim().min(1, "errors.required").max(max, "errors.tooLong");

export const VaultNameSchema = z.object({ name: requiredText(80) });

export const PersonInputSchema = z.object({
  displayName: requiredText(80),
  relationLabel: optionalText(40),
  birthYear: z
    .union([z.literal(""), z.coerce.number()], "errors.birthYear")
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value))
    .pipe(
      z
        .number()
        .int("errors.birthYear")
        .min(1850, "errors.birthYear")
        .max(new Date().getFullYear(), "errors.birthYear")
        .nullable(),
    ),
  notes: optionalText(2000),
});
export type PersonInput = z.infer<typeof PersonInputSchema>;

export const InvitableRoleSchema = z.enum(["admin", "member", "viewer"]);

/** International phone number, digits only after "+", e.g. +447700900123. */
export const PhoneSchema = z
  .string()
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, "errors.phone"));

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email("errors.email"));

export const InviteInputSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("link"),
    role: InvitableRoleSchema,
    personId: z.uuid().nullable(),
  }),
  z.object({
    channel: z.literal("phone"),
    role: InvitableRoleSchema,
    personId: z.uuid().nullable(),
    phone: PhoneSchema,
  }),
  z.object({
    channel: z.literal("email"),
    role: InvitableRoleSchema,
    personId: z.uuid().nullable(),
    email: EmailSchema,
  }),
]);
export type InviteInput = z.infer<typeof InviteInputSchema>;

export const UnitSystemSchema = z.enum(["metric", "us_customary", "cups_spoons"]);
export type UnitSystem = z.infer<typeof UnitSystemSchema>;

export const ProfileInputSchema = z.object({
  displayName: requiredText(80),
  preferredLanguage: LanguageSchema,
  unitSystem: UnitSystemSchema,
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .transform((value) => (value === "" ? null : value))
    .pipe(z.string().refine(isCountryCode, "errors.country").nullable()),
});
export type ProfileInput = z.infer<typeof ProfileInputSchema>;

/** First error message (an i18n key) per field, for showing beside form inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    out[field] ??= issue.message;
  }
  return out;
}
