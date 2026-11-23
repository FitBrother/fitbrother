export type BillingReturnState = "success" | "cancel" | "neutral";

export function billingReturnState(params: {
  status?: string;
  session_id?: string;
}): BillingReturnState {
  if (params.session_id || params.status === "success") return "success";
  if (params.status === "cancel") return "cancel";
  return "neutral";
}
