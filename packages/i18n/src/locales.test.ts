import { describe, expect, it } from "vitest";
import { resources } from "./index.ts";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

const english = flatten(resources.en.translation);

describe.each(["hi", "gu"] as const)("%s locale", (locale) => {
  const strings = flatten(resources[locale].translation);

  it("has exactly the English keys", () => {
    expect([...strings.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it("keeps every interpolation placeholder", () => {
    for (const [key, text] of english) {
      expect(placeholders(strings.get(key) ?? ""), key).toEqual(placeholders(text));
    }
  });

  it("has no empty strings", () => {
    for (const [key, text] of strings) expect(text.trim(), key).not.toBe("");
  });
});
