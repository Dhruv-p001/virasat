import { describe, expect, it } from "vitest";
import { safeNextPath } from "./paths.ts";

describe("safeNextPath", () => {
  it.each([
    ["/vault/abc", "/vault/abc"],
    ["/invite/tok?x=1#y", "/invite/tok?x=1#y"],
    ["/", "/"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/vault\n//evil",
    "",
    null,
    undefined,
  ])("rejects %j", (input) => {
    expect(safeNextPath(input, "/home")).toBe("/home");
  });
});
