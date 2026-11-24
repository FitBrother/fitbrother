import type { BillingInterval } from "@fitbrother/shared";
import { BILLING_UNAVAILABLE_MESSAGE } from "@/lib/billing-errors";

export function checkoutErrorMessage(code: string): string {
  if (code === "already_subscribed") return "Você já tem uma assinatura ativa.";
  return BILLING_UNAVAILABLE_MESSAGE;
}

export function parseInterval(raw: string | string[] | undefined): BillingInterval | null {
  return raw === "month" || raw === "year" ? raw : null;
}
