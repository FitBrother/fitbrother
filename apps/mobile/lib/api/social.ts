import {
  ContactsSyncResponseSchema,
  FollowingResponseSchema,
  LeaderboardResponseSchema,
  type FollowedProfile,
  type LeaderboardRow,
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

export async function verifyPhone(): Promise<void> {
  const res = await authedFetch("/me/verify-phone", { method: "POST" });
  await parseOrThrow(res);
}

export async function syncContacts(hashes: string[]): Promise<FollowedProfile[]> {
  const res = await authedFetch("/contacts/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hashes }),
  });
  const body = await parseOrThrow(res);
  return ContactsSyncResponseSchema.parse(body).followed;
}

export async function fetchFollowing(): Promise<FollowedProfile[]> {
  const res = await authedFetch("/following");
  const body = await parseOrThrow(res);
  return FollowingResponseSchema.parse(body).following;
}

export async function fetchWeeklyLeaderboard(): Promise<LeaderboardRow[]> {
  const res = await authedFetch("/leaderboard/weekly");
  const body = await parseOrThrow(res);
  return LeaderboardResponseSchema.parse(body).rows;
}
