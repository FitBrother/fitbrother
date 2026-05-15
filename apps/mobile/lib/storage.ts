import { supabase } from "./supabase";

const AUDIO_BUCKET = "meal-audios";

/**
 * Upload an opus audio file recorded for a meal.
 *
 * Storage RLS expects `{user_id}/{meal_id}.opus` — `(storage.foldername(name))[1]`
 * must equal `auth.uid()`. Path is built from the authenticated session.
 */
export async function uploadMealAudio(params: {
  userId: string;
  mealId: string;
  fileUri: string;
}): Promise<{ path: string }> {
  const path = `${params.userId}/${params.mealId}.opus`;
  const response = await fetch(params.fileUri);
  const blob = await response.blob();

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, { contentType: "audio/ogg", upsert: false });

  if (error) throw error;
  return { path };
}

export async function getMealAudioSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
