import { describe, expect, it } from "vitest";
import { characterErrorRate, normalizeTranscript, wordErrorRate } from "./error-rate.ts";

describe("normalizeTranscript", () => {
  it("ignores punctuation, danda, case and extra whitespace", () => {
    expect(normalizeTranscript("  Pehla, tel garam karo।  Pachhi   RAI nakho! ")).toBe(
      "pehla tel garam karo pachhi rai nakho",
    );
  });

  it("maps Gujarati and Devanagari digits to ASCII", () => {
    expect(normalizeTranscript("૨ ચમચી")).toBe("2 ચમચી");
    expect(normalizeTranscript("२ चम्मच")).toBe("2 चम्मच");
  });

  it("keeps vowel signs and virama, which change the word", () => {
    expect(normalizeTranscript("ચણા")).not.toBe(normalizeTranscript("ચણ"));
    expect(normalizeTranscript("चम्मच")).toContain("्");
  });

  it("treats canonically equivalent Unicode as equal", () => {
    expect(normalizeTranscript("\u0958")).toBe(normalizeTranscript("\u0915\u093C"));
  });
});

describe("wordErrorRate", () => {
  it("is zero for identical text after normalisation", () => {
    expect(wordErrorRate("Tel garam karo.", "tel garam karo").rate).toBe(0);
  });

  it("counts substitutions, deletions and insertions", () => {
    const result = wordErrorRate("ek mutthi besan nakho", "ek muththi besan nakho pachhi");
    expect(result).toEqual({
      rate: 2 / 4,
      substitutions: 1,
      deletions: 0,
      insertions: 1,
      referenceLength: 4,
    });
  });

  it("scores Gujarati script word by word", () => {
    const result = wordErrorRate("એક મુઠ્ઠી બેસન નાખો", "એક મુઠી બેસન");
    expect(result.substitutions).toBe(1);
    expect(result.deletions).toBe(1);
    expect(result.rate).toBe(0.5);
  });

  it("handles an empty reference without dividing by zero", () => {
    expect(wordErrorRate("", "").rate).toBe(0);
    expect(wordErrorRate("", "noise").rate).toBe(1);
  });
});

describe("characterErrorRate", () => {
  it("does not punish a word split that keeps every character", () => {
    expect(characterErrorRate("ભાતભાત", "ભાત ભાત").rate).toBe(0);
  });

  it("counts a grapheme cluster as one character", () => {
    // "क्ष" is one grapheme: क + virama + ष.
    expect(characterErrorRate("क्ष", "क").substitutions).toBe(1);
  });
});
