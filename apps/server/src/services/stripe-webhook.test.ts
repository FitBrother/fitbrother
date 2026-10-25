import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("../lib/env.js", () => ({ env: {} }));

import { processStripeEvent, type WebhookDeps } from "./stripe-webhook.js";

function sub(status: string, extra: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status,
    metadata: {},
    items: { data: [] },
    ...extra,
  } as unknown as Stripe.Subscription;
}

function evt(type: string, object: Record<string, unknown>): Stripe.Event {
  return { id: "evt_1", type, data: { object } } as unknown as Stripe.Event;
}

function makeDeps(over: Partial<WebhookDeps> = {}) {
  const calls: string[] = [];
  const deps = {
    claimEvent: vi.fn(async () => {
      calls.push("claim");
      return "new" as const;
    }),
    retrieveSubscription: vi.fn(async () => {
      calls.push("retrieve");
      return sub("active");
    }),
    userIdForCustomer: vi.fn(async () => "user-1" as string | null),
    applySubscription: vi.fn(async () => {
      calls.push("apply");
    }),
    markProcessed: vi.fn(async () => {
      calls.push("mark");
    }),
    ...over,
  } satisfies WebhookDeps;
  return { deps, calls };
}

describe("processStripeEvent", () => {
  it("returns duplicate without touching other deps when already done", async () => {
    const { deps } = makeDeps({ claimEvent: vi.fn(async () => "done" as const) });
    const res = await processStripeEvent(
      evt("customer.subscription.updated", { id: "sub_1", customer: "cus_1" }),
      deps,
    );
    expect(res).toBe("duplicate");
    expect(deps.retrieveSubscription).not.toHaveBeenCalled();
    expect(deps.userIdForCustomer).not.toHaveBeenCalled();
    expect(deps.applySubscription).not.toHaveBeenCalled();
    expect(deps.markProcessed).not.toHaveBeenCalled();
  });

  it("reprocesses on retry and reaches the same state", async () => {
    const first = makeDeps();
    const retry = makeDeps({ claimEvent: vi.fn(async () => "retry" as const) });
    const e = evt("customer.subscription.updated", { id: "sub_1", customer: "cus_1" });
    await processStripeEvent(e, first.deps);
    const res = await processStripeEvent(e, retry.deps);
    expect(res).toBe("processed");
    expect(retry.deps.applySubscription).toHaveBeenCalledWith(
      "user-1",
      "cus_1",
      expect.objectContaining({ plan: "pro", status: "active" }),
    );
    expect(vi.mocked(retry.deps.applySubscription).mock.calls[0]).toEqual(
      vi.mocked(first.deps.applySubscription).mock.calls[0],
    );
  });

  it("applies the state read from Stripe, not the payload (out of order)", async () => {
    const { deps } = makeDeps({ retrieveSubscription: vi.fn(async () => sub("canceled")) });
    await processStripeEvent(
      evt("customer.subscription.updated", { id: "sub_1", customer: "cus_1", status: "active" }),
      deps,
    );
    expect(deps.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(deps.applySubscription).toHaveBeenCalledWith(
      "user-1",
      "cus_1",
      expect.objectContaining({
        plan: "free",
        status: "canceled",
        provider_subscription_id: "sub_1",
      }),
    );
  });

  it("resolves checkout.session.completed by client_reference_id", async () => {
    const { deps } = makeDeps();
    const res = await processStripeEvent(
      evt("checkout.session.completed", {
        client_reference_id: "user-9",
        customer: "cus_1",
        subscription: "sub_1",
      }),
      deps,
    );
    expect(res).toBe("processed");
    expect(deps.userIdForCustomer).not.toHaveBeenCalled();
    expect(deps.applySubscription).toHaveBeenCalledWith("user-9", "cus_1", expect.anything());
  });

  it("falls back to session metadata then customer lookup", async () => {
    const a = makeDeps();
    await processStripeEvent(
      evt("checkout.session.completed", {
        client_reference_id: null,
        metadata: { user_id: "user-m" },
        customer: "cus_1",
        subscription: "sub_1",
      }),
      a.deps,
    );
    expect(a.deps.applySubscription).toHaveBeenCalledWith("user-m", "cus_1", expect.anything());
    const b = makeDeps();
    await processStripeEvent(
      evt("checkout.session.completed", { customer: "cus_1", subscription: "sub_1" }),
      b.deps,
    );
    expect(b.deps.applySubscription).toHaveBeenCalledWith("user-1", "cus_1", expect.anything());
  });

  it("prefers subscription metadata user_id over the customer lookup", async () => {
    const { deps } = makeDeps({
      retrieveSubscription: vi.fn(async () =>
        sub("active", { metadata: { user_id: "user-meta" } }),
      ),
      userIdForCustomer: vi.fn(async () => "user-other"),
    });
    await processStripeEvent(
      evt("customer.subscription.created", { id: "sub_1", customer: "cus_1" }),
      deps,
    );
    expect(deps.applySubscription).toHaveBeenCalledWith("user-meta", "cus_1", expect.anything());
  });

  it("applies free/canceled on subscription.deleted", async () => {
    const { deps } = makeDeps({ retrieveSubscription: vi.fn(async () => sub("canceled")) });
    await processStripeEvent(
      evt("customer.subscription.deleted", { id: "sub_1", customer: "cus_1" }),
      deps,
    );
    expect(deps.applySubscription).toHaveBeenCalledWith(
      "user-1",
      "cus_1",
      expect.objectContaining({ plan: "free", status: "canceled" }),
    );
  });

  it("falls back to free/canceled when the deleted subscription is missing in Stripe", async () => {
    const err = Object.assign(new Error("gone"), { code: "resource_missing" });
    const { deps } = makeDeps({
      retrieveSubscription: vi.fn(async () => {
        throw err;
      }),
    });
    const res = await processStripeEvent(
      evt("customer.subscription.deleted", { id: "sub_1", customer: "cus_1" }),
      deps,
    );
    expect(res).toBe("processed");
    expect(deps.applySubscription).toHaveBeenCalledWith(
      "user-1",
      "cus_1",
      expect.objectContaining({
        plan: "free",
        status: "canceled",
        provider: "stripe",
        provider_subscription_id: "sub_1",
      }),
    );
  });

  it("rethrows other retrieve errors without marking processed", async () => {
    const { deps } = makeDeps({
      retrieveSubscription: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(
      processStripeEvent(
        evt("customer.subscription.updated", { id: "sub_1", customer: "cus_1" }),
        deps,
      ),
    ).rejects.toThrow("boom");
    expect(deps.markProcessed).not.toHaveBeenCalled();
  });

  it("reapplies the read state on invoice.payment_failed", async () => {
    const { deps } = makeDeps({ retrieveSubscription: vi.fn(async () => sub("past_due")) });
    await processStripeEvent(
      evt("invoice.payment_failed", { customer: "cus_1", subscription: "sub_1" }),
      deps,
    );
    expect(deps.applySubscription).toHaveBeenCalledWith(
      "user-1",
      "cus_1",
      expect.objectContaining({ plan: "pro", status: "past_due" }),
    );
  });

  it("reads the subscription id from invoice parent details", async () => {
    const { deps } = makeDeps();
    await processStripeEvent(
      evt("invoice.payment_failed", {
        customer: "cus_1",
        parent: { subscription_details: { subscription: "sub_1" } },
      }),
      deps,
    );
    expect(deps.retrieveSubscription).toHaveBeenCalledWith("sub_1");
  });

  it("ignores events with no resolvable user and marks processed", async () => {
    const { deps } = makeDeps({ userIdForCustomer: vi.fn(async () => null) });
    const res = await processStripeEvent(
      evt("checkout.session.completed", { customer: "cus_x", subscription: "sub_1" }),
      deps,
    );
    expect(res).toBe("ignored");
    expect(deps.applySubscription).not.toHaveBeenCalled();
    expect(deps.markProcessed).toHaveBeenCalledWith("evt_1");
  });

  it("ignores subscription events for unknown customers and marks processed", async () => {
    const { deps } = makeDeps({ userIdForCustomer: vi.fn(async () => null) });
    const res = await processStripeEvent(
      evt("customer.subscription.updated", { id: "sub_1", customer: "cus_x" }),
      deps,
    );
    expect(res).toBe("ignored");
    expect(deps.applySubscription).not.toHaveBeenCalled();
    expect(deps.markProcessed).toHaveBeenCalledWith("evt_1");
  });

  it("ignores unhandled types without needing a user, still marking processed", async () => {
    const { deps } = makeDeps();
    const res = await processStripeEvent(evt("charge.refunded", { customer: "cus_1" }), deps);
    expect(res).toBe("ignored");
    expect(deps.userIdForCustomer).not.toHaveBeenCalled();
    expect(deps.retrieveSubscription).not.toHaveBeenCalled();
    expect(deps.markProcessed).toHaveBeenCalledWith("evt_1");
  });

  it("marks processed only after a successful apply", async () => {
    const { deps, calls } = makeDeps();
    await processStripeEvent(
      evt("customer.subscription.updated", { id: "sub_1", customer: "cus_1" }),
      deps,
    );
    expect(calls).toEqual(["claim", "retrieve", "apply", "mark"]);
  });

  it("does not mark processed when apply fails", async () => {
    const { deps } = makeDeps({
      applySubscription: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    await expect(
      processStripeEvent(
        evt("customer.subscription.updated", { id: "sub_1", customer: "cus_1" }),
        deps,
      ),
    ).rejects.toThrow("db down");
    expect(deps.markProcessed).not.toHaveBeenCalled();
  });
});
