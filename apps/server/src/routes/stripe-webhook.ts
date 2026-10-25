import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";
import { env } from "../lib/env.js";
import { stripeClient } from "../lib/stripe.js";
import {
  defaultWebhookDeps,
  processStripeEvent,
  type WebhookDeps,
} from "../services/stripe-webhook.js";

type Options = { deps?: WebhookDeps; stripe?: Stripe };

export async function stripeWebhookRoute(app: FastifyInstance, opts: Options) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });

  app.post("/webhooks/stripe", async (req, reply) => {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !signature || !Buffer.isBuffer(req.body)) {
      return reply.code(400).send({ error: "invalid_signature" });
    }
    const stripe = opts.stripe ?? stripeClient();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return reply.code(400).send({ error: "invalid_signature" });
    }
    const result = await processStripeEvent(event, opts.deps ?? defaultWebhookDeps());
    return reply.send({ received: true, result });
  });
}
