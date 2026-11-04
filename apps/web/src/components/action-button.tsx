"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action-state.ts";
import { idle } from "@/lib/action-state.ts";
import { useMessage } from "@/lib/i18n/client.tsx";
import { SubmitButton } from "./submit-button.tsx";

/** A one-click server action (remove, leave, cancel), optionally confirmed first. */
export function ActionButton({
  action,
  label,
  confirm,
  kind = "danger",
}: {
  action: () => Promise<ActionState>;
  label: string;
  confirm?: string;
  kind?: "primary" | "secondary" | "danger";
}) {
  const message = useMessage();
  const [state, run] = useActionState(async () => action(), idle);
  return (
    <form action={run} className="flex flex-col items-start gap-2">
      <SubmitButton kind={kind} {...(confirm ? { confirm } : {})}>
        {label}
      </SubmitButton>
      {state.status === "error" && state.message && (
        <span role="alert" className="text-sm font-medium text-danger">
          {message(state.message)}
        </span>
      )}
    </form>
  );
}
