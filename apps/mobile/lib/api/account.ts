import {
  AccountConsentResponseSchema,
  AccountProfileResponseSchema,
  AccountSettingsResponseSchema,
  DeleteAccountResponseSchema,
  type AccountConsentResponse,
  type AccountProfileResponse,
  type AccountSettingsResponse,
  type DeleteAccountResponse,
  type PatchAccountSettingsRequest,
  type PostAccountConsentRequest,
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

export async function getAccountProfile(): Promise<AccountProfileResponse> {
  const res = await authedFetch("/account/profile");
  const body = await parseOrThrow(res);
  return AccountProfileResponseSchema.parse(body);
}

export async function patchAccountSettings(
  body: PatchAccountSettingsRequest,
): Promise<AccountSettingsResponse> {
  const res = await authedFetch("/account/settings", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const parsed = await parseOrThrow(res);
  return AccountSettingsResponseSchema.parse(parsed);
}

export async function postAccountConsent(
  body: PostAccountConsentRequest,
): Promise<AccountConsentResponse> {
  const res = await authedFetch("/account/consent", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const parsed = await parseOrThrow(res);
  return AccountConsentResponseSchema.parse(parsed);
}

/** Stream cru do ZIP — sem parse, o caller decide como consumir. */
export async function getAccountExport(): Promise<Response> {
  const res = await authedFetch("/account/export");
  if (!res.ok) {
    const err: ApiError = new Error(`account_export_failed_${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

export async function deleteAccount(): Promise<DeleteAccountResponse> {
  const res = await authedFetch("/account", {
    method: "DELETE",
    body: JSON.stringify({ confirm: true }),
  });
  const parsed = await parseOrThrow(res);
  return DeleteAccountResponseSchema.parse(parsed);
}
