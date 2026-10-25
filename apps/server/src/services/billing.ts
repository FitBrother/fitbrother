import type { BillingInterval, SubscriptionResponse } from "@fitbrother/shared";
import type Stripe from "stripe";
import { env } from "../lib/env.js";
import { stripeClient } from "../lib/stripe.js";
import { supabaseService } from "../lib/supabase.js";
import { BillingError } from "./billing-status.js";

export type BillingRow = {
  plan: "free" | "pro";
  status: "active" | "past_due" | "canceled" | "trialing";
  stripe_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_end: string | null;
};

export type BillingStore = {
  getRow(userId: string): Promise<BillingRow | null>;
  saveCustomerId(userId: string, customerId: string): Promise<void>;
};

export type BillingDeps = { stripe: Stripe; store: BillingStore };

const COLUMNS = "plan, status, stripe_customer_id, provider_subscription_id, current_period_end";

function supabaseBillingStore(): BillingStore {
  return {
    async getRow(userId) {
      const { data, error } = await supabaseService()
        .from("subscriptions")
        .select(COLUMNS)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as BillingRow | null) ?? null;
    },
    async saveCustomerId(userId, customerId) {
      const admin = supabaseService();
      const { data, error } = await admin
        .from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId)
        .select("user_id");
      if (error) throw new Error(error.message);
      if (data && data.length > 0) return;
      const { error: insertError } = await admin
        .from("subscriptions")
        .insert({ user_id: userId, stripe_customer_id: customerId });
      if (insertError) throw new Error(insertError.message);
    },
  };
}

export function defaultBillingDeps(): BillingDeps {
  return { stripe: stripeClient(), store: supabaseBillingStore() };
}

function priceFor(interval: BillingInterval): string {
  const price = interval === "year" ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY;
  if (!price) throw new BillingError("billing_not_configured");
  return price;
}

export async function createCheckoutUrl(
  userId: string,
  email: string | null,
  interval: BillingInterval,
  deps: BillingDeps = defaultBillingDeps(),
): Promise<string> {
  const row = await deps.store.getRow(userId);
  if (row && row.plan === "pro" && (row.status === "active" || row.status === "trialing")) {
    throw new BillingError("already_subscribed");
  }
  const price = priceFor(interval);

  let customerId = row?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await deps.stripe.customers.create({
      ...(email ? { email } : {}),
      metadata: { user_id: userId },
    });
    customerId = customer.id;
    await deps.store.saveCustomerId(userId, customerId);
  }

  const trialDays = env.STRIPE_TRIAL_DAYS;
  const eligibleForTrial = trialDays > 0 && !row?.provider_subscription_id;

  const session = await deps.stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    metadata: { user_id: userId },
    line_items: [{ price, quantity: 1 }],
    success_url: `${env.APP_URL}/billing-return?status=success`,
    cancel_url: `${env.APP_URL}/billing-return?status=cancel`,
    ...(eligibleForTrial
      ? { subscription_data: { trial_period_days: trialDays, metadata: { user_id: userId } } }
      : { subscription_data: { metadata: { user_id: userId } } }),
  });
  if (!session.url) throw new Error("stripe_checkout_without_url");
  return session.url;
}

export async function createPortalUrl(
  userId: string,
  deps: BillingDeps = defaultBillingDeps(),
): Promise<string> {
  const row = await deps.store.getRow(userId);
  if (!row?.stripe_customer_id) throw new BillingError("no_customer");
  const session = await deps.stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: `${env.APP_URL}/billing-return?status=portal`,
  });
  return session.url;
}

export async function getSubscription(
  userId: string,
  deps: BillingDeps = defaultBillingDeps(),
): Promise<SubscriptionResponse> {
  const row = await deps.store.getRow(userId);
  if (!row)
    return { plan: "free", status: "active", current_period_end: null, has_customer: false };
  return {
    plan: row.plan,
    status: row.status,
    current_period_end: row.current_period_end,
    has_customer: Boolean(row.stripe_customer_id),
  };
}
