export const BILLING_UNAVAILABLE_MESSAGE =
  "Assinatura indisponível no momento. Tente novamente mais tarde.";

export function billingErrorMessage(code: string): string | null {
  if (code === "already_subscribed") return null;
  return BILLING_UNAVAILABLE_MESSAGE;
}
