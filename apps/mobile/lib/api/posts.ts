import {
  CommentSchema,
  CommentsResponseSchema,
  FeedResponseSchema,
  LikeResponseSchema,
  PostResponseSchema,
  type Comment,
  type LikeResponse,
  type Post,
} from "@fitbrother/shared";
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

export async function fetchPost(postId: string): Promise<Post> {
  const res = await authedFetch(`/posts/${postId}`);
  const body = await parseOrThrow(res);
  return PostResponseSchema.parse(body).post;
}

export async function setLike(postId: string, liked: boolean): Promise<LikeResponse> {
  const res = await authedFetch(`/posts/${postId}/like`, { method: liked ? "POST" : "DELETE" });
  const body = await parseOrThrow(res);
  return LikeResponseSchema.parse(body);
}

export async function fetchComments(postId: string): Promise<Comment[]> {
  const res = await authedFetch(`/posts/${postId}/comments`);
  const body = await parseOrThrow(res);
  return CommentsResponseSchema.parse(body).comments;
}

export async function addComment(
  postId: string,
  input: { id: string; body: string },
): Promise<Comment> {
  const res = await authedFetch(`/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = (await parseOrThrow(res)) as { comment: unknown };
  return CommentSchema.parse(body.comment);
}

export async function deleteComment(commentId: string): Promise<void> {
  await parseOrThrow(await authedFetch(`/comments/${commentId}`, { method: "DELETE" }));
}
