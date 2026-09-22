import type {
  AccountConsentResponse,
  AccountDeletionStateResponse,
  AccountProfileResponse,
  AccountSettingsResponse,
  AnthropometricsResponse,
  BodyProfileResponse,
  DeleteAccountResponse,
  NutritionGoalResponse,
  PatchAccountSettingsRequest,
  PatchBodyProfileRequest,
  PostAnthropometricsRequest,
  PostNutritionGoalsRequest,
  ReactivateAccountResponse,
  SuggestedNutritionGoalsResponse,
} from "@fitbrother/shared";
import { authedFetch } from "@/lib/api";
import { exportFilename } from "@/lib/account-utils";
import { POLICY_VERSION } from "@/lib/constants";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authedFetch(path, init);
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `request_failed_${response.status}`);
  return body;
}

export const getAccountProfile = () => json<AccountProfileResponse>("/account/profile");

export const patchAccountSettings = (body: PatchAccountSettingsRequest) =>
  json<AccountSettingsResponse>("/account/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const patchAccountAvatar = (avatarUrl: string | null) =>
  json<{ profile: { avatar_url: string | null; updated_at: string } }>("/account/profile", {
    method: "PATCH",
    body: JSON.stringify({ avatar_url: avatarUrl }),
  });

export const getCurrentAnthropometrics = () =>
  json<{ anthropometrics: AnthropometricsResponse | null }>("/account/anthropometrics/current");

export const postAnthropometrics = (body: PostAnthropometricsRequest) =>
  json<{ anthropometrics: AnthropometricsResponse }>("/account/anthropometrics", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const patchBodyProfile = (body: PatchBodyProfileRequest) =>
  json<{ profile: BodyProfileResponse }>("/account/body-profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const getCurrentNutritionGoals = () =>
  json<{ goal: NutritionGoalResponse | null }>("/account/nutrition-goals/current");

export const getSuggestedNutritionGoals = () =>
  json<SuggestedNutritionGoalsResponse>("/account/nutrition-goals/suggested");

export const postNutritionGoals = (body: PostNutritionGoalsRequest) =>
  json<{ goal: NutritionGoalResponse }>("/account/nutrition-goals", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const setMarketingConsent = (granted: boolean) =>
  json<AccountConsentResponse>("/account/consent", {
    method: "POST",
    body: JSON.stringify({ scope: "marketing", granted, policy_version: POLICY_VERSION }),
  });

export async function getAccountExport(): Promise<{ bytes: Uint8Array; filename: string }> {
  const response = await authedFetch("/account/export");
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `account_export_failed_${response.status}`);
  }
  const filename = exportFilename(response.headers.get("content-disposition"));
  return { bytes: new Uint8Array(await response.arrayBuffer()), filename };
}

export const getDeletionState = () => json<AccountDeletionStateResponse>("/account/deletion");

export const reactivateAccount = () =>
  json<ReactivateAccountResponse>("/account/deletion/cancel", { method: "POST" });

export const authorizeDeletionWithPassword = (password: string) =>
  json<{ authorization_token: string; expires_at: string }>(
    "/account/deletion/authorize/password",
    { method: "POST", body: JSON.stringify({ password }) },
  );

export const startDeletionOAuth = (provider: "google" | "apple") =>
  json<{ challenge_token: string; expires_at: string }>("/account/deletion/authorize/oauth/start", {
    method: "POST",
    body: JSON.stringify({ provider }),
  });

export const completeDeletionOAuth = (provider: "google" | "apple", challengeToken: string) =>
  json<{ authorization_token: string; expires_at: string }>(
    "/account/deletion/authorize/oauth/complete",
    { method: "POST", body: JSON.stringify({ provider, challenge_token: challengeToken }) },
  );

export const deleteAccount = (authorizationToken: string) =>
  json<DeleteAccountResponse>("/account", {
    method: "DELETE",
    body: JSON.stringify({ confirm: true, authorization_token: authorizationToken }),
  });
