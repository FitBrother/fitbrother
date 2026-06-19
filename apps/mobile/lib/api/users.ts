import {
  UserSearchResponseSchema,
  UsernameAvailableResponseSchema,
  type PublicProfile,
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

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const res = await authedFetch(`/users/username-available?u=${encodeURIComponent(username)}`);
  const body = await parseOrThrow(res);
  return UsernameAvailableResponseSchema.parse(body).available;
}

export async function searchUsers(q: string): Promise<PublicProfile[]> {
  const res = await authedFetch(`/users/search?q=${encodeURIComponent(q)}`);
  const body = await parseOrThrow(res);
  return UserSearchResponseSchema.parse(body).users;
}

export async function followUser(followeeId: string): Promise<void> {
  const res = await authedFetch("/follows", {
    method: "POST",
    body: JSON.stringify({ followee_id: followeeId }),
  });
  await parseOrThrow(res);
}

export async function unfollowUser(followeeId: string): Promise<void> {
  const res = await authedFetch(`/follows/${encodeURIComponent(followeeId)}`, {
    method: "DELETE",
  });
  await parseOrThrow(res);
}
