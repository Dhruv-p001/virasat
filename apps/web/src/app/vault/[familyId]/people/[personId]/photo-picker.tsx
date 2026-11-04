"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { getBrowserClient } from "@/lib/supabase/browser.ts";
import { setPersonPhoto } from "../../actions.ts";

const MAX_BYTES = 10 * 1024 * 1024; // matches the vault-images bucket limit
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

/** Uploads straight to storage as the user (RLS-checked), then records the path on the person. */
export function PhotoPicker({
  familyId,
  personId,
  label,
}: {
  familyId: string;
  personId: string;
  label: string;
}) {
  const t = useT();
  const message = useMessage();
  const router = useRouter();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const extension = EXTENSIONS[file.type];
    if (!extension) {
      setError("errors.generic");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("person.photoTooLarge");
      return;
    }

    setBusy(true);
    const path = `${familyId}/people/${personId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await getBrowserClient()
      .storage.from("vault-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    const result = uploadError ? null : await setPersonPhoto(familyId, personId, path);
    setBusy(false);
    if (uploadError || result?.status === "error") {
      setError(result?.status === "error" && result.message ? result.message : "errors.generic");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={inputId}
        className="inline-flex min-h-tap-target cursor-pointer items-center self-start font-semibold text-accent underline underline-offset-4"
      >
        {busy ? t("common.saving") : label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={Object.keys(EXTENSIONS).join(",")}
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && (
        <span role="alert" className="text-sm font-medium text-danger">
          {message(error)}
        </span>
      )}
    </div>
  );
}
