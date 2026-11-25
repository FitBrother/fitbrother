import { QuotaExceededError, getErrorStatus } from "@/lib/api/meals";
import type { ErrorBannerVariant } from "@/components/domain/ErrorBanner";

export function registerErrorKind(err: Error): ErrorBannerVariant {
  if (err instanceof QuotaExceededError) return "quota_exceeded";
  if (err.message === "backfill_window_exceeded") return "backfill_window_exceeded";
  if (err.message === "request_timeout") return "offline";
  if ((getErrorStatus(err) ?? 0) >= 500) return "server_error";
  return "network";
}
