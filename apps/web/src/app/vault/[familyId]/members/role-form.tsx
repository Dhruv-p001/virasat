"use client";

import type { FamilyRole } from "@virasat/core";
import { useActionState } from "react";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { changeRole } from "../actions.ts";

/** Role picker that saves as soon as a new role is chosen. */
export function RoleForm({
  familyId,
  profileId,
  current,
  options,
}: {
  familyId: string;
  profileId: string;
  current: FamilyRole;
  options: { value: FamilyRole; label: string }[];
}) {
  const t = useT();
  const message = useMessage();
  const [state, action, pending] = useActionState(changeRole.bind(null, familyId, profileId), idle);

  return (
    <form action={action} className="flex flex-col gap-1">
      <select
        name="role"
        defaultValue={current}
        aria-label={t("members.role")}
        disabled={pending}
        className="min-h-tap-target rounded-md border-2 border-outline bg-surface px-2"
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {state.status === "error" && state.message && (
        <span role="alert" className="text-sm font-medium text-danger">
          {message(state.message)}
        </span>
      )}
    </form>
  );
}
