import type { SubscriptionResponse } from "@fitbrother/shared";

export function subscriptionLabel(sub: SubscriptionResponse): string {
  if (sub.plan !== "pro") return "Plano gratuito";
  if (sub.status === "active") return "Premium";
  if (sub.status === "trialing") return "Premium (teste grátis)";
  if (sub.status === "past_due") return "Premium (pagamento pendente)";
  return "Plano gratuito";
}

export function subscriptionPressTarget(sub: SubscriptionResponse | undefined): "portal" | "plans" {
  return sub?.plan === "pro" ? "portal" : "plans";
}
