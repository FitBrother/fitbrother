import { supabase } from "./supabase";

const AUDIO_BUCKET = "meal-audios";

/**
 * Upload an audio file recorded for a meal.
 *
 * Storage RLS expects `{user_id}/{meal_id}.{ext}` — `(storage.foldername(name))[1]`
 * must equal `auth.uid()`. Path is built from the authenticated session.
 *
 * `ext` controls both the filename and the MIME hint (iOS m4a → audio/mp4,
 * Android opus → audio/ogg). Both extensions are in the bucket allowlist.
 */
export async function uploadMealAudio(params: {
  userId: string;
  mealId: string;
  fileUri: string;
  ext: "m4a" | "opus";
}): Promise<{ path: string }> {
  const path = `${params.userId}/${params.mealId}.${params.ext}`;
  const contentType = params.ext === "m4a" ? "audio/mp4" : "audio/ogg";

  const response = await fetch(params.fileUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, { contentType, upsert: false });

  if (error) throw error;
  return { path };
}

export async function getMealAudioSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
