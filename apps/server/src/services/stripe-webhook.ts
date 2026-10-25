import type Stripe from "stripe";
import { Sentry } from "../lib/sentry.js";
import { stripeClient } from "../lib/stripe.js";
import { supabaseService } from "../lib/supabase.js";
import { mapStripeSubscription, type SubscriptionUpdate } from "./billing-status.js";

export type WebhookDeps = {
  claimEvent(id: string, type: string): Promise<"new" | "retry" | "done">;
  retrieveSubscription(id: string): Promise<Stripe.Subscription>;
  userIdForCustomer(customerId: string): Promise<string | null>;
  applySubscription(userId: string, customerId: string, update: SubscriptionUpdate): Promise<void>;
  markProcessed(id: string): Promise<void>;
};

export type WebhookResult = "processed" | "duplicate" | "ignored";

type Ref = string | { id: string } | null | undefined;

function idOf(ref: Ref): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : (ref.id ?? null);
}

function metaUserId(meta: Stripe.Metadata | null | undefined): string | null {
  return meta?.user_id || null;
}

export function defaultWebhookDeps(): WebhookDeps {
  return {
    async claimEvent(id, type) {
      const admin = supabaseService();
      const { error } = await admin.from("stripe_events").insert({ event_id: id, type });
      if (!error) return "new";
      if (error.code !== "23505") throw new Error(error.message);
      const { data, error: readError } = await admin
        .from("stripe_events")
        .select("processed_at")
        .eq("event_id", id)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      return data?.processed_at ? "done" : "retry";
    },
    retrieveSubscription: (id) => stripeClient().subscriptions.retrieve(id),
    async userIdForCustomer(customerId) {
      const { data, error } = await supabaseService()
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_customer_id", customerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.user_id ?? null;
    },
    async applySubscription(userId, customerId, update) {
      const admin = supabaseService();
      const { data, error } = await admin
        .from("subscriptions")
        .update({ ...update, stripe_customer_id: customerId })
        .eq("user_id", userId)
        .select("user_id");
      if (error) throw new Error(error.message);
      if (data && data.length > 0) return;
      const { error: insertError } = await admin
        .from("subscriptions")
        .insert({ user_id: userId, stripe_customer_id: customerId, ...update });
      if (insertError) throw new Error(insertError.message);
    },
    async markProcessed(id) {
      const { error } = await supabaseService()
        .from("stripe_events")
        .update({ processed_at: new Date().toISOString() })
        .eq("event_id", id);
      if (error) throw new Error(error.message);
    },
  };
}

function isResourceMissing(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "resource_missing";
}

function canceledUpdate(subscriptionId: string): SubscriptionUpdate {
  return {
    plan: "free",
    status: "canceled",
    current_period_start: null,
    current_period_end: null,
    provider: "stripe",
    provider_subscription_id: subscriptionId,
  };
}

function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const parent = invoice.parent as
    | { subscription_details?: { subscription?: Ref } }
    | null
    | undefined;
  return idOf(invoice.subscription as Ref) ?? idOf(parent?.subscription_details?.subscription);
}

async function syncSubscription(
  subscriptionId: string,
  customerId: string | null,
  hintedUserId: string | null,
  allowMissing: boolean,
  deps: WebhookDeps,
): Promise<boolean> {
  let sub: Stripe.Subscription | null = null;
  try {
    sub = await deps.retrieveSubscription(subscriptionId);
  } catch (err) {
    if (!(allowMissing && isResourceMissing(err))) throw err;
  }
  const customer = idOf(sub?.customer as Ref) ?? customerId;
  const userId =
    metaUserId(sub?.metadata) ??
    hintedUserId ??
    (customer ? await deps.userIdForCustomer(customer) : null);
  if (!userId || !customer) return false;
  const update = sub ? mapStripeSubscription(sub) : canceledUpdate(subscriptionId);
  await deps.applySubscription(userId, customer, update);
  return true;
}

async function handle(event: Stripe.Event, deps: WebhookDeps): Promise<boolean | null> {
  const obj = event.data.object as unknown as Record<string, unknown>;
  switch (event.type) {
    case "checkout.session.completed": {
      const subscriptionId = idOf(obj.subscription as Ref);
      if (!subscriptionId) return null;
      const hinted =
        (obj.client_reference_id as string | null | undefined) ||
        metaUserId(obj.metadata as Stripe.Metadata | null);
      return syncSubscription(subscriptionId, idOf(obj.customer as Ref), hinted, false, deps);
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const hinted = metaUserId(obj.metadata as Stripe.Metadata | null);
      return syncSubscription(
        obj.id as string,
        idOf(obj.customer as Ref),
        hinted,
        event.type === "customer.subscription.deleted",
        deps,
      );
    }
    case "invoice.payment_failed": {
      const subscriptionId = invoiceSubscriptionId(obj);
      if (!subscriptionId) return null;
      return syncSubscription(subscriptionId, idOf(obj.customer as Ref), null, false, deps);
    }
    default:
      return null;
  }
}

export async function processStripeEvent(
  event: Stripe.Event,
  deps: WebhookDeps,
): Promise<WebhookResult> {
  const claim = await deps.claimEvent(event.id, event.type);
  if (claim === "done") return "duplicate";

  const applied = await handle(event, deps);
  if (applied === false) {
    console.warn("stripe_webhook_user_not_found", { event_id: event.id, type: event.type });
    Sentry.captureMessage("stripe_webhook_user_not_found", {
      level: "warning",
      tags: { stripe_event_type: event.type },
      extra: { event_id: event.id },
    });
  }
  await deps.markProcessed(event.id);
  return applied === true ? "processed" : "ignored";
}
