"use client";

import { whatsAppShareUrl } from "@virasat/core";
import { useActionState, useState } from "react";
import { Button, ButtonLink, Notice, TextInput } from "@/components/ui.tsx";
import { SubmitButton } from "@/components/submit-button.tsx";
import { idle } from "@/lib/action-state.ts";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { type CreatedRecordingLink, createRecordingLink } from "../../actions.ts";
import type { ActionState } from "@/lib/action-state.ts";

/** Creates a recording link and shows it once, with copy and WhatsApp buttons. */
export function RecordingLinkForm({
  familyId,
  personId,
  name,
}: {
  familyId: string;
  personId: string;
  name: string;
}) {
  const t = useT();
  const message = useMessage();
  const [copied, setCopied] = useState(false);
  const [state, create] = useActionState<ActionState<CreatedRecordingLink>>(
    createRecordingLink.bind(null, familyId, personId),
    idle,
  );
  const url = state.status === "success" ? state.data?.url : undefined;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      // The field below is selectable, so the link can still be copied by hand.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {url ? (
        <>
          <Notice kind="success">{t("recordingLinks.ready")}</Notice>
          <label className="flex flex-col gap-2">
            <span className="font-medium">{t("recordingLinks.linkLabel", { name })}</span>
            <TextInput
              readOnly
              value={url}
              dir="ltr"
              onFocus={(event) => {
                event.target.select();
              }}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => void copy(url)}>
              {copied ? t("recordingLinks.copied") : t("recordingLinks.copy")}
            </Button>
            <ButtonLink
              href={whatsAppShareUrl(t("recordingLinks.shareText", { url }))}
              kind="secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("recordingLinks.whatsapp")}
            </ButtonLink>
          </div>
        </>
      ) : (
        <form action={create} className="flex flex-col items-start gap-3">
          <SubmitButton>{t("recordingLinks.create")}</SubmitButton>
          {state.status === "error" && state.message && (
            <span role="alert" className="text-sm font-medium text-danger">
              {message(state.message)}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
