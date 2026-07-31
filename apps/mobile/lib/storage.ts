import { supabase } from "./supabase";

const AUDIO_BUCKET = "meal-audios";
const IMAGE_BUCKET = "post-images";

/**
 * Upload an audio file recorded for a meal.
 *
 * Storage RLS expects `{user_id}/{meal_id}.{ext}` — `(storage.foldername(name))[1]`
 * must equal `auth.uid()`. Path is built from the authenticated session.
 *
 * `ext` controls both the filename and the MIME hint (iOS m4a → audio/mp4,
 * Android opus → audio/ogg). Both extensions are in the bucket allowlist.
 *
 * Why FormData and not fetch().blob():
 *   On React Native iOS, `fetch(fileUri).blob()` against a `file://` URI
 *   silently returns a 0-byte Blob (or fails opaquely). Supabase Storage
 *   then accepts a corrupt/empty upload and the server-side Whisper call
 *   crashes downstream. The canonical RN pattern — and what Supabase's
 *   own docs recommend — is FormData carrying the URI directly; the
 *   underlying networking layer streams the file bytes for us.
 */
export async function uploadMealAudio(params: {
  userId: string;
  mealId: string;
  fileUri: string;
  ext: "m4a" | "opus";
}): Promise<{ path: string }> {
  const path = `${params.userId}/${params.mealId}.${params.ext}`;
  const contentType = params.ext === "m4a" ? "audio/mp4" : "audio/ogg";

  const formData = new FormData();
  formData.append("file", {
    uri: params.fileUri,
    name: `${params.mealId}.${params.ext}`,
    type: contentType,
    // RN's FormData accepts this object shape; the official types don't
    // model it, so we cast at the boundary.
  } as unknown as Blob);

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, formData, { contentType, upsert: false });

  if (error) throw error;
  return { path };
}

export async function getMealAudioSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadPostImage(params: {
  userId: string;
  postId: string;
  fileUri: string;
}): Promise<{ path: string }> {
  const path = `${params.userId}/post-${params.postId}.jpg`;
  const formData = new FormData();
  formData.append("file", {
    uri: params.fileUri,
    name: `post-${params.postId}.jpg`,
    type: "image/jpeg",
  } as unknown as Blob);

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, formData, { contentType: "image/jpeg", upsert: true });

  if (error) throw error;
  return { path };
}

export async function getPostImageSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadAvatar(params: {
  userId: string;
  fileUri: string;
}): Promise<{ path: string }> {
  const path = `${params.userId}/avatar.jpg`;
  const formData = new FormData();
  formData.append("file", {
    uri: params.fileUri,
    name: "avatar.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, formData, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  return { path };
}

export async function uploadMealPhoto(params: {
  userId: string;
  mealId: string;
  fileUri: string;
}): Promise<{ path: string }> {
  const path = `${params.userId}/meal-photos/${params.mealId}.jpg`;
  const formData = new FormData();
  formData.append("file", {
    uri: params.fileUri,
    name: `${params.mealId}.jpg`,
    type: "image/jpeg",
  } as unknown as Blob);

  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, formData, { contentType: "image/jpeg", upsert: false });

  if (error) throw error;
  return { path };
}
