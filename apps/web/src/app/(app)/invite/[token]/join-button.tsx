"use client";

import { ActionButton } from "@/components/action-button.tsx";
import { acceptInvite } from "./actions.ts";

export function JoinButton({ token, label }: { token: string; label: string }) {
  return <ActionButton action={() => acceptInvite(token)} label={label} kind="primary" />;
}
