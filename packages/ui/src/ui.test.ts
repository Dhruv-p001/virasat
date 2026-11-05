import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avatar, initials } from "./avatar.tsx";
import { Button, buttonClass } from "./button.tsx";
import { cn } from "./cn.ts";
import { EmptyState } from "./empty-state.tsx";
import { currentHref } from "./nav.tsx";
import { Skeleton, SkeletonRegion } from "./skeleton.tsx";

describe("cn", () => {
  it("lets the later class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("keeps our elder text size next to a text colour", () => {
    expect(cn("text-elder", "text-ink")).toBe("text-elder text-ink");
  });
});

describe("buttons", () => {
  it("gives elder buttons a 56px target and 20pt text", () => {
    const classes = buttonClass("primary", "elder");
    expect(classes).toContain("min-h-elder-tap-target");
    expect(classes).toContain("text-elder");
  });

  it("never submits a form by accident", () => {
    expect(renderToStaticMarkup(createElement(Button, null, "Go"))).toContain('type="button"');
  });
});

describe("avatar", () => {
  it("takes the first grapheme of each word in every launch script", () => {
    expect(initials("Kamla Patel")).toBe("KP");
    expect(initials("બા પટેલ")).toBe("બાપ");
    expect(initials("बा पटेल")).toBe("बाप");
  });

  it("is hidden from screen readers when it is only initials", () => {
    expect(renderToStaticMarkup(createElement(Avatar, { name: "Ba" }))).toContain("aria-hidden");
  });

  // The elder-facing /record page imports this file and has a JavaScript budget.
  it("imports nothing heavy", () => {
    const source = readFileSync(new URL("./avatar.tsx", import.meta.url), "utf8");
    const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((match) => match[1]);
    expect(imports).toEqual(["./cn.ts"]);
  });
});

describe("states", () => {
  it("announces a loading region once and hides the shapes", () => {
    const html = renderToStaticMarkup(
      createElement(SkeletonRegion, { label: "Loading", children: createElement(Skeleton) }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading");
    expect(html).toContain('aria-hidden="true"');
  });

  it("an empty state shows its title, body and next action", () => {
    const html = renderToStaticMarkup(
      createElement(EmptyState, {
        title: "Nothing yet",
        body: "Add someone.",
        action: createElement("a", { href: "/x" }, "Add"),
      }),
    );
    expect(html).toContain("Nothing yet");
    expect(html).toContain("Add someone.");
    expect(html).toContain('href="/x"');
  });
});

describe("navigation", () => {
  const items = [
    { href: "/vault/a", label: "Vault", icon: null },
    { href: "/vault/a/moments", label: "Moments", icon: null },
    { href: "/settings", label: "You", icon: null },
  ];

  it("highlights the most specific item", () => {
    expect(currentHref("/vault/a/moments", items)).toBe("/vault/a/moments");
    expect(currentHref("/vault/a/people/b", items)).toBe("/vault/a");
    expect(currentHref("/settings", items)).toBe("/settings");
  });

  it("highlights nothing off the map, and does not match prefixes of other words", () => {
    expect(currentHref("/elsewhere", items)).toBeNull();
    expect(currentHref("/vault/ab", items)).toBeNull();
  });
});
