import "server-only";
import { cache } from "react";
import { createClient } from "./supabase/server.ts";

// Reads for recipes and family moments, as the signed-in user: RLS decides what is visible
// (a private recipe's moments stay private; other families see nothing).

const PHOTO_URL_SECONDS = 60 * 60;

export async function signedImageUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (wanted.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("vault-images")
    .createSignedUrls(wanted, PHOTO_URL_SECONDS);
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl]] : [],
    ),
  );
}

export const listRecipes = cache(async (familyId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .select("id, title, origin_person_id, created_at")
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
});

export type Moment = Awaited<ReturnType<typeof listMoments>>[number];

export const listMoments = cache(async (familyId: string, limit = 50) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, recipe_id, author_profile_id, note, rating, cooked_on, photo_path, created_at, recipe:recipes!attempts_recipe_id_fkey(title), author:profiles!attempts_author_profile_id_fkey(display_name)",
    )
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .order("cooked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const urls = await signedImageUrls(data.map((moment) => moment.photo_path));
  return data.map((moment) => ({
    id: moment.id,
    recipeId: moment.recipe_id,
    recipeTitle: moment.recipe.title,
    authorId: moment.author_profile_id,
    authorName: moment.author?.display_name ?? "",
    note: moment.note,
    rating: moment.rating,
    cookedOn: moment.cooked_on,
    photoUrl: moment.photo_path ? (urls.get(moment.photo_path) ?? null) : null,
  }));
});

/** One recipe's moments, newest first. RLS: whoever can read the recipe sees them. */
export async function listRecipeMoments(recipeId: string, limit = 20) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, author_profile_id, note, rating, cooked_on, photo_path, created_at, author:profiles!attempts_author_profile_id_fkey(display_name)",
    )
    .eq("recipe_id", recipeId)
    .is("deleted_at", null)
    .order("cooked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const urls = await signedImageUrls(data.map((moment) => moment.photo_path));
  return data.map((moment) => ({
    id: moment.id,
    authorName: moment.author?.display_name ?? "",
    note: moment.note,
    rating: moment.rating,
    cookedOn: moment.cooked_on,
    photoUrl: moment.photo_path ? (urls.get(moment.photo_path) ?? null) : null,
  }));
}
