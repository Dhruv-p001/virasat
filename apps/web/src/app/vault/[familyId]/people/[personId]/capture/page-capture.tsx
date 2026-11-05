"use client";

import {
  MAX_SCAN_BYTES,
  MAX_SCAN_PAGES,
  READABLE_COPY_MIME,
  scanMimeType,
  type CaptureFile,
} from "@virasat/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, Card, Notice } from "@/components/ui.tsx";
import { useCaptureUpload } from "@/lib/capture/use-capture-upload.ts";
import { makeReadableCopy, type ReadableCopy } from "@/lib/capture/readable-copy.ts";
import { useT } from "@/lib/i18n/client.tsx";

// Photographing handwritten pages. Each page is stored exactly as the camera made it. A readable
// copy (upright, JPEG, at most 2000 px) is made here, in the browser, because that is what the page
// reader takes (ADR 0014). Nothing is sent until the organiser says so.

type Page = {
  key: string;
  original: File;
  mime: string;
  copy: ReadableCopy;
  previewUrl: string;
};

export function PageCapture({ familyId, personId }: { familyId: string; personId: string }) {
  const t = useT();
  const [agreed, setAgreed] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const upload = useCaptureUpload(personId);

  // Preview URLs hold memory until released.
  const previews = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of previews.current) URL.revokeObjectURL(url);
    },
    [],
  );

  async function addFiles(list: FileList | null) {
    const chosen = [...(list ?? [])];
    if (chosen.length === 0) return;
    const problems: string[] = [];
    const room = MAX_SCAN_PAGES - pages.length;
    if (chosen.length > room) problems.push(t("capture.tooManyPages", { max: MAX_SCAN_PAGES }));

    setPreparing(true);
    const added: Page[] = [];
    for (const file of chosen.slice(0, Math.max(room, 0))) {
      const mime = scanMimeType(file);
      if (!mime) {
        problems.push(t("capture.notAPhoto", { name: file.name }));
      } else if (file.size > MAX_SCAN_BYTES) {
        problems.push(t("capture.photoTooLarge", { name: file.name }));
      } else {
        const copy = await makeReadableCopy(file);
        if (!copy) {
          problems.push(t("capture.cantOpen", { name: file.name }));
        } else {
          const previewUrl = URL.createObjectURL(copy.blob);
          previews.current.push(previewUrl);
          added.push({ key: crypto.randomUUID(), original: file, mime, copy, previewUrl });
        }
      }
    }
    setPages((current) => [...current, ...added]);
    setMessages(problems);
    setPreparing(false);
  }

  function removePage(key: string) {
    setPages((current) => current.filter((page) => page.key !== key));
  }

  async function send() {
    const files: CaptureFile<Blob>[] = [
      ...pages.map((page, index) => ({
        role: "page" as const,
        page: index,
        mime: page.mime,
        blob: page.original,
        size: page.original.size,
      })),
      ...pages.map((page, index) => ({
        role: "copy" as const,
        page: index,
        mime: READABLE_COPY_MIME,
        blob: page.copy.blob,
        size: page.copy.blob.size,
        width: page.copy.width,
        height: page.copy.height,
      })),
    ];
    await upload.submit({
      id: crypto.randomUUID(),
      familyId,
      personId,
      source: "handwriting",
      files,
    });
    setPages([]);
  }

  const waitingHref = `/vault/${familyId}/captures`;

  if (upload.status === "sending" || upload.status === "waiting") {
    const waiting = upload.status === "waiting";
    return (
      <Card className="flex flex-col gap-3" role="status">
        {upload.resumed && <p className="text-muted">{t("capture.resumed")}</p>}
        <h2 className="text-xl">{t(waiting ? "capture.waitingTitle" : "capture.sendingTitle")}</h2>
        <p>{t(waiting ? "capture.waitingPagesBody" : "capture.sendingBody")}</p>
      </Card>
    );
  }

  if (upload.status === "sent") {
    return (
      <Card className="flex flex-col gap-4" role="status">
        <h2 className="text-xl">{t("capture.sentPagesTitle")}</h2>
        <p>{t("capture.sentPagesBody")}</p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={waitingHref}>{t("capture.seeWaiting")}</ButtonLink>
          <Button kind="secondary" onClick={upload.reset}>
            {t("capture.addMorePages")}
          </Button>
        </div>
      </Card>
    );
  }

  if (upload.status === "problem") {
    return (
      <Card className="flex flex-col gap-4">
        <Notice kind="error">
          {t(
            upload.problem === "not_allowed"
              ? "capture.problemNotAllowed"
              : "capture.problemRejected",
          )}
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void upload.retry()}>{t("capture.tryAgain")}</Button>
          <Button kind="danger" onClick={() => void upload.discard()}>
            {t("capture.discard")}
          </Button>
        </div>
      </Card>
    );
  }

  const full = pages.length >= MAX_SCAN_PAGES;

  return (
    <Card className="flex flex-col items-start gap-4">
      {upload.resumed && <p className="text-muted">{t("capture.resumed")}</p>}
      <p className="text-muted">{t("capture.pagesHint", { max: MAX_SCAN_PAGES })}</p>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="camera-input"
        aria-label={t("capture.takePhoto")}
        onChange={(event) => {
          void addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        data-testid="page-files"
        aria-label={t("capture.choosePhotos")}
        onChange={(event) => {
          void addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-3">
        <Button
          kind="secondary"
          disabled={full || preparing}
          onClick={() => camera.current?.click()}
        >
          {t("capture.takePhoto")}
        </Button>
        <Button
          kind="secondary"
          disabled={full || preparing}
          onClick={() => gallery.current?.click()}
        >
          {t("capture.choosePhotos")}
        </Button>
      </div>

      {preparing && (
        <p role="status" className="text-muted">
          {t("capture.preparing")}
        </p>
      )}
      {messages.length > 0 && (
        <Notice kind="error">
          {messages.map((message) => (
            <span key={message} className="block">
              {message}
            </span>
          ))}
        </Notice>
      )}

      {pages.length > 0 && (
        <ol className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4" data-testid="pages">
          {pages.map((page, index) => (
            <li key={page.key} className="flex flex-col gap-2">
              {/* A blob URL for this page only: next/image has nothing to optimise here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page.previewUrl}
                alt={t("capture.pageLabel", { n: index + 1 })}
                className="aspect-[3/4] w-full rounded-md border border-border object-cover"
              />
              <Button
                kind="quiet"
                className="min-h-tap-target"
                onClick={() => {
                  removePage(page.key);
                }}
              >
                {t("capture.removePage", { n: index + 1 })}
              </Button>
            </li>
          ))}
        </ol>
      )}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => {
            setAgreed(event.target.checked);
          }}
          className="mt-1 size-6 shrink-0"
        />
        <span>{t("consent.scanNote")}</span>
      </label>
      <Button disabled={!agreed || pages.length === 0 || preparing} onClick={() => void send()}>
        {t("capture.sendPages")}
      </Button>
      <Link href={waitingHref} className="text-muted underline underline-offset-4">
        {t("capture.seeWaiting")}
      </Link>
    </Card>
  );
}
