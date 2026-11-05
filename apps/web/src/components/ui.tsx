import { PageHeader } from "@virasat/ui/page";
import type { ReactNode } from "react";

// The shared components live in @virasat/ui. This file keeps the names Phase 1 and capture
// screens already import. It re-exports only server-safe components, so importing it from the
// elder-facing /record page never pulls Radix, Vaul, Sonner or Motion into that page's bundle.

export { Avatar } from "@virasat/ui/avatar";
export { Button } from "@virasat/ui/button";
export { Card } from "@virasat/ui/card";
export { EmptyState } from "@virasat/ui/empty-state";
export { Field, Select, TextArea, TextInput } from "@virasat/ui/field";
export { ButtonLink } from "@virasat/ui/link-button";
export { Notice } from "@virasat/ui/notice";
export { Section } from "@virasat/ui/page";

export function PageShell({
  title,
  back,
  actions,
  eyebrow,
  wide = false,
  children,
}: {
  title: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  eyebrow?: ReactNode;
  /** For screens that put two things side by side on a desktop, like a recording beside its recipe. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className={`mx-auto flex w-full flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8 ${wide ? "max-w-5xl" : "max-w-2xl"}`}
    >
      <PageHeader title={title} back={back} actions={actions} eyebrow={eyebrow} />
      {children}
    </main>
  );
}
