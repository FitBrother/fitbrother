import { FeedResponseSchema, PostResponseSchema, type Post } from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.status === 204 ? {} : res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function fetchFeed(): Promise<Post[]> {
  const res = await authedFetch("/feed");
  const body = await parseOrThrow(res);
  return FeedResponseSchema.parse(body).posts;
}

export async function createPost(input: {
  id: string;
  meal_id: string;
  caption?: string;
  image_path?: string;
}): Promise<Post> {
  const res = await authedFetch("/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = await parseOrThrow(res);
  return PostResponseSchema.parse(body).post;
}

export async function createAchievementPost(input: {
  id: string;
  achievement_id: string;
  caption?: string;
}): Promise<Post> {
  const res = await authedFetch("/posts/achievement", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = await parseOrThrow(res);
  return PostResponseSchema.parse(body).post;
}
