import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  InviteInputSchema,
  PersonInputSchema,
  ProfileInputSchema,
  VaultNameSchema,
} from "./forms.ts";

describe("VaultNameSchema", () => {
  it("trims and requires a name", () => {
    expect(VaultNameSchema.parse({ name: "  Shah family " })).toEqual({ name: "Shah family" });
    const result = VaultNameSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error)).toEqual({ name: "errors.required" });
  });
});

describe("PersonInputSchema", () => {
  it("turns empty optional fields into null", () => {
    expect(
      PersonInputSchema.parse({
        displayName: "Kantaben",
        relationLabel: " ",
        birthYear: "",
        notes: "",
      }),
    ).toEqual({ displayName: "Kantaben", relationLabel: null, birthYear: null, notes: null });
  });

  it("accepts a birth year from a form field", () => {
    expect(PersonInputSchema.parse({ displayName: "Ba", birthYear: "1941" }).birthYear).toBe(1941);
  });

  it.each(["1700", "3000", "19.5", "nineteen"])("rejects birth year %s", (birthYear) => {
    const result = PersonInputSchema.safeParse({ displayName: "Ba", birthYear });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).birthYear).toBe("errors.birthYear");
  });

  it("keeps names in any script", () => {
    expect(PersonInputSchema.parse({ displayName: "કાંતાબેન", relationLabel: "બા" })).toMatchObject(
      {
        displayName: "કાંતાબેન",
        relationLabel: "બા",
      },
    );
  });
});

describe("InviteInputSchema", () => {
  it("normalises phone numbers to E.164", () => {
    const parsed = InviteInputSchema.parse({
      channel: "phone",
      role: "member",
      personId: null,
      phone: "+44 7700 900-123",
    });
    expect(parsed).toMatchObject({ phone: "+447700900123" });
  });

  it("rejects numbers without a country code", () => {
    const result = InviteInputSchema.safeParse({
      channel: "phone",
      role: "member",
      personId: null,
      phone: "07700900123",
    });
    expect(result.success).toBe(false);
  });

  it("lowercases emails", () => {
    expect(
      InviteInputSchema.parse({
        channel: "email",
        role: "viewer",
        personId: null,
        email: " Mom@Example.COM ",
      }),
    ).toMatchObject({ email: "mom@example.com" });
  });

  it("never allows inviting an owner", () => {
    expect(
      InviteInputSchema.safeParse({ channel: "link", role: "owner", personId: null }).success,
    ).toBe(false);
  });
});

describe("ProfileInputSchema", () => {
  it("accepts a complete profile and normalises the country", () => {
    expect(
      ProfileInputSchema.parse({
        displayName: "Dhruv",
        preferredLanguage: "gu",
        unitSystem: "cups_spoons",
        countryCode: "gb",
      }),
    ).toEqual({
      displayName: "Dhruv",
      preferredLanguage: "gu",
      unitSystem: "cups_spoons",
      countryCode: "GB",
    });
  });

  it("allows no country", () => {
    expect(
      ProfileInputSchema.parse({
        displayName: "D",
        preferredLanguage: "en",
        unitSystem: "metric",
        countryCode: "",
      }).countryCode,
    ).toBeNull();
  });
});
