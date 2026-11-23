import type { BillingInterval } from "@fitbrother/shared";

export function embeddedCheckoutSupported(os: string): boolean {
  return os === "web";
}

export function checkoutHref(interval: BillingInterval): string {
  return `/checkout?interval=${interval}`;
}
