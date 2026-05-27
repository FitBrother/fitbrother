import {
  AchievementsResponseSchema,
  RegisterPushTokenRequestSchema,
  UserAchievementsResponseSchema,
  type Achievement,
  type DevicePlatform,
  type UserAchievement,
} from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";

type ApiError = Error & { status?: number };

async function parseOrThrow(res: Response): Promise<unknown> {
  if (res.ok) return res.json();
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  const err: ApiError = new Error(body.error ?? `request_failed_${res.status}`);
  err.status = res.status;
  throw err;
}

export async function fetchAchievements(): Promise<Achievement[]> {
  const res = await authedFetch("/achievements");
  const body = await parseOrThrow(res);
  return AchievementsResponseSchema.parse(body).achievements;
}

export async function fetchMyAchievements(): Promise<UserAchievement[]> {
  const res = await authedFetch("/me/achievements");
  const body = await parseOrThrow(res);
  return UserAchievementsResponseSchema.parse(body).achievements;
}

export async function registerPushToken(token: string, platform: DevicePlatform): Promise<void> {
  const payload = RegisterPushTokenRequestSchema.parse({ token, platform });
  const res = await authedFetch("/push-tokens", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) await parseOrThrow(res);
}
