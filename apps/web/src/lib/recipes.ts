import "server-only";
import { type Ingredient, IngredientSchema, readableMedia } from "@virasat/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { assertUuid } from "./data.ts";
import { signedImageUrls } from "./moments.ts";
import { createClient } from "./supabase/server.ts";

// One recipe for its page, as the signed-in user: RLS decides who may read it (a recipe in another
// family is simply not found). The page shows the current version. The original recording and
// pages belong to the original version, and stay with the recipe through any later correction.

const FILE_URL_SECONDS = 60 * 60;
/** Page formats every browser can show. A HEIC page without its readable copy cannot be shown. */
const DISPLAYABLE_PAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type RecipeAudio =
  | { state: "ready"; url: string }
  /** The file was removed (consent withdrawn) or cannot be signed. The written recipe stays. */
  | { state: "removed" }
  | { state: "missing" };

export type RecipePage = { url: string | null; width: number | null; height: number | null };

export const getRecipe = cache(async (familyId: string, recipeId: string) => {
  assertUuid(familyId);
  assertUuid(recipeId);
  const supabase = await createClient();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .select("id, title, origin_person_id, root_version_id, current_version_id")
    .eq("id", recipeId)
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!recipe?.current_version_id) notFound();

  const [
    { data: version, error: versionError },
    { data: person },
    { data: media, error: mediaError },
  ] = await Promise.all([
    supabase
      .from("recipe_versions")
      .select("title, servings, ingredients, steps, tips, story, language, source_type")
      .eq("id", recipe.current_version_id)
      .single(),
    recipe.origin_person_id
      ? supabase
          .from("people")
          .select("display_name, relation_label, photo_path")
          .eq("id", recipe.origin_person_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    recipe.root_version_id
      ? supabase
          .from("media")
          .select(
            "id, kind, derived_from_media_id, storage_bucket, storage_path, mime_type, width, height, removed_at",
          )
          .eq("recipe_version_id", recipe.root_version_id)
          .in("kind", ["original_audio", "handwriting_scan", "derived_scan"])
          .order("created_at")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (versionError) throw versionError;
  if (mediaError) throw mediaError;

  const ingredients: Ingredient[] = z.array(IngredientSchema).catch([]).parse(version.ingredients);
  const steps = z
    .array(z.object({ text: z.string() }))
    .catch([])
    .parse(version.steps);
  const tips = z.array(z.string()).catch([]).parse(version.tips);

  // The recording, if there is one. A removed recording leaves the row, and the recipe says so.
  let audio: RecipeAudio | null = null;
  const recording = media.find((row) => row.kind === "original_audio");
  if (recording) {
    if (recording.removed_at) {
      audio = { state: "removed" };
    } else {
      const { data } = await supabase.storage
        .from(recording.storage_bucket)
        .createSignedUrl(recording.storage_path, FILE_URL_SECONDS);
      audio = data?.signedUrl ? { state: "ready", url: data.signedUrl } : { state: "missing" };
    }
  }

  // Handwritten pages in order, each as the reader saw it: its readable copy when it has one.
  const scans = media.filter((row) => row.kind !== "original_audio" && row.removed_at === null);
  const pages: RecipePage[] = await Promise.all(
    readableMedia(scans).map(async (row) => {
      if (!DISPLAYABLE_PAGE_TYPES.has(row.mime_type)) {
        return { url: null, width: row.width, height: row.height };
      }
      const { data } = await supabase.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, FILE_URL_SECONDS);
      return { url: data?.signedUrl ?? null, width: row.width, height: row.height };
    }),
  );

  const photos = await signedImageUrls([person?.photo_path ?? null]);
  return {
    id: recipe.id,
    title: version.title,
    servings: version.servings,
    ingredients,
    steps,
    tips,
    story: version.story,
    language: version.language,
    source: version.source_type,
    person: person
      ? {
          name: person.relation_label ?? person.display_name,
          fullName: person.display_name,
          photoUrl: person.photo_path ? (photos.get(person.photo_path) ?? null) : null,
        }
      : null,
    audio,
    pages,
  };
});
