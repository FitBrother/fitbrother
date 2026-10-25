import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import Stripe from "stripe";

const SECRET = "whsec_test_secret";
const mockEnv = vi.hoisted(() => ({ STRIPE_WEBHOOK_SECRET: "whsec_test_secret" }));
vi.mock("../lib/env.js", () => ({ env: mockEnv }));

import type { WebhookDeps } from "../services/stripe-webhook.js";
import { stripeWebhookRoute } from "./stripe-webhook.js";

const stripe = new Stripe("sk_test_fake");

function fakeDeps(over: Partial<WebhookDeps> = {}): WebhookDeps {
  return {
    claimEvent: vi.fn(async () => "new" as const),
    retrieveSubscription: vi.fn(async () => ({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: {},
      items: { data: [] },
    })) as unknown as WebhookDeps["retrieveSubscription"],
    userIdForCustomer: vi.fn(async () => "user-1"),
    applySubscription: vi.fn(async () => {}),
    markProcessed: vi.fn(async () => {}),
    ...over,
  };
}

async function build(deps: WebhookDeps) {
  const app = Fastify();
  await app.register(stripeWebhookRoute, { deps, stripe });
  return app;
}

const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "customer.subscription.updated",
  data: { object: { id: "sub_1", customer: "cus_1" } },
});

function signed(body = payload, secret = SECRET) {
  return Stripe.webhooks.generateTestHeaderString({ payload: body, secret });
}

const post = (
  app: Awaited<ReturnType<typeof build>>,
  headers: Record<string, string>,
  body = payload,
) =>
  app.inject({
    method: "POST",
    url: "/webhooks/stripe",
    headers: { "content-type": "application/json", ...headers },
    payload: body,
  });

describe("POST /webhooks/stripe", () => {
  it("returns 400 without a signature header and does not claim the event", async () => {
    const deps = fakeDeps();
    const res = await post(await build(deps), {});
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid_signature" });
    expect(deps.claimEvent).not.toHaveBeenCalled();
  });

  it("returns 400 with an invalid signature", async () => {
    const deps = fakeDeps();
    const res = await post(await build(deps), {
      "stripe-signature": signed(payload, "whsec_wrong"),
    });
    expect(res.statusCode).toBe(400);
    expect(deps.claimEvent).not.toHaveBeenCalled();
  });

  it("returns 200 and applies state with a valid signature", async () => {
    const deps = fakeDeps();
    const res = await post(await build(deps), { "stripe-signature": signed() });
    expect(res.statusCode).toBe(200);
    expect(deps.applySubscription).toHaveBeenCalledTimes(1);
    expect(deps.markProcessed).toHaveBeenCalledWith("evt_1");
  });

  it("returns 200 for duplicates", async () => {
    const deps = fakeDeps({ claimEvent: vi.fn(async () => "done" as const) });
    const res = await post(await build(deps), { "stripe-signature": signed() });
    expect(res.statusCode).toBe(200);
    expect(deps.applySubscription).not.toHaveBeenCalled();
  });

  it("returns 5xx when processing throws", async () => {
    const deps = fakeDeps({
      applySubscription: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const res = await post(await build(deps), { "stripe-signature": signed() });
    expect(res.statusCode).toBe(500);
    expect(deps.markProcessed).not.toHaveBeenCalled();
  });
});
