import { describe, expect, it } from "vitest";
import { generateToken } from "./tokens.ts";

describe("generateToken", () => {
  it("produces URL-safe tokens of the requested entropy", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("never repeats across many draws", () => {
    const tokens = new Set(Array.from({ length: 10_000 }, () => generateToken(16)));
    expect(tokens.size).toBe(10_000);
  });

  it("refuses anything below 128 bits", () => {
    expect(() => generateToken(15)).toThrow(RangeError);
    expect(() => generateToken(16.5)).toThrow(RangeError);
  });
});
