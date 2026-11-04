"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useT } from "@/lib/i18n/client.tsx";
import { Button } from "./ui.tsx";

/** Submit button that disables itself and says so while the form's action runs. */
export function SubmitButton({
  children,
  kind = "primary",
  confirm,
}: {
  children: ReactNode;
  kind?: "primary" | "secondary" | "danger";
  /** Ask before submitting (destructive actions). */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  const t = useT();
  return (
    <Button
      type="submit"
      kind={kind}
      disabled={pending}
      aria-disabled={pending}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? t("common.saving") : children}
    </Button>
  );
}
