"use client";

import { buttonClass } from "@virasat/ui/button";
import { cn } from "@virasat/ui/cn";
import { Sheet, SheetContent, SheetTrigger } from "@virasat/ui/sheet";
import { toast } from "@virasat/ui/toaster";
import { Camera, ChefHat, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { addMoment, setMomentPhoto } from "@/app/vault/[familyId]/moments/actions.ts";
import { Field, Notice, Select, TextArea, TextInput } from "@/components/ui.tsx";
import { useMessage, useT } from "@/lib/i18n/client.tsx";
import { getBrowserClient } from "@/lib/supabase/browser.ts";
import { Button } from "./ui.tsx";

const MAX_BYTES = 10 * 1024 * 1024; // matches the vault-images bucket limit
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the viewer's day

/**
 * "I cooked it": a bottom sheet with a photo, a note, a rating and a date. Needs a recipe: fixed
 * with `recipeId` (from a recipe page), or chosen from `recipes`.
 */
export function CookedSheet({
  familyId,
  recipes,
  recipeId,
  variant = "primary",
}: {
  familyId: string;
  recipes: { id: string; title: string }[];
  recipeId?: string;
  variant?: "primary" | "secondary";
}) {
  const t = useT();
  const message = useMessage();
  const router = useRouter();
  const photoInputId = useId();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [rating, setRating] = useState("");

  function submit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    if (photo && (!EXTENSIONS[photo.type] || photo.size > MAX_BYTES)) {
      setError(photo.size > MAX_BYTES ? "person.photoTooLarge" : "errors.generic");
      return;
    }
    startTransition(async () => {
      const result = await addMoment(familyId, { status: "idle" }, formData);
      if (result.status !== "success" || !result.data) {
        if (result.status === "error") {
          setFieldErrors(result.fieldErrors ?? {});
          setError(result.message ?? null);
        }
        return;
      }
      let photoFailed = false;
      if (photo) {
        const { momentId } = result.data;
        const path = `${familyId}/moments/${momentId}/${crypto.randomUUID()}.${EXTENSIONS[photo.type]}`;
        const { error: uploadError } = await getBrowserClient()
          .storage.from("vault-images")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        const saved = uploadError ? null : await setMomentPhoto(familyId, momentId, path);
        photoFailed = Boolean(uploadError) || saved?.status === "error";
      }
      setOpen(false);
      setPhoto(null);
      setRating("");
      if (photoFailed) toast.error(t("moments.photoFailed"));
      else toast.success(t("moments.saved"));
      router.refresh();
    });
  }

  const fieldError = (field: string) =>
    fieldErrors[field] ? message(fieldErrors[field]) : undefined;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className={buttonClass(variant)}>
        <ChefHat aria-hidden className="size-5" />
        {t("moments.cooked")}
      </SheetTrigger>
      <SheetContent title={t("moments.cooked")} description={t("moments.sheetDescription")}>
        <form action={submit} className="flex flex-col gap-4">
          {error && <Notice kind="error">{message(error)}</Notice>}
          {recipeId ? (
            <input type="hidden" name="recipeId" value={recipeId} />
          ) : (
            <Field label={t("moments.recipeLabel")} error={fieldError("recipeId")}>
              <Select name="recipeId" required defaultValue="">
                <option value="" disabled>
                  {t("moments.recipeLabel")}
                </option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="flex flex-col gap-2">
            <span className="font-medium">{t("moments.photoLabel")}</span>
            <label
              htmlFor={photoInputId}
              className={cn(
                buttonClass("secondary"),
                "cursor-pointer self-start has-[:focus-visible]:outline-3",
              )}
            >
              <Camera aria-hidden className="size-5" />
              {photo ? t("moments.photoChange") : t("moments.photoAdd")}
            </label>
            <input
              id={photoInputId}
              type="file"
              accept={Object.keys(EXTENSIONS).join(",")}
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                setPhoto(event.target.files?.[0] ?? null);
              }}
            />
            {photo && <span className="text-sm text-muted">{photo.name}</span>}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="font-medium">{t("moments.ratingLabel")}</legend>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label key={value} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="rating"
                    value={value}
                    checked={rating === String(value)}
                    onChange={() => {
                      setRating(String(value));
                    }}
                    className="peer sr-only"
                    aria-label={t("moments.stars", { count: value })}
                  />
                  <Star
                    aria-hidden
                    className="size-10 p-1.5 text-accent peer-focus-visible:outline-3 peer-focus-visible:outline-outline"
                    fill={Number(rating) >= value ? "currentColor" : "none"}
                    strokeWidth={1.75}
                  />
                </label>
              ))}
            </div>
            {fieldError("rating") && (
              <span role="alert" className="text-sm font-medium text-danger">
                {fieldError("rating")}
              </span>
            )}
          </fieldset>

          <Field label={t("moments.noteLabel")} error={fieldError("note")}>
            <TextArea
              name="note"
              rows={3}
              maxLength={1000}
              placeholder={t("moments.notePlaceholder")}
            />
          </Field>

          <Field label={t("moments.dateLabel")} error={fieldError("cookedOn")}>
            <TextInput name="cookedOn" type="date" required defaultValue={today()} max={today()} />
          </Field>

          <Button type="submit" disabled={pending} aria-disabled={pending}>
            {pending ? t("common.saving") : t("moments.save")}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
