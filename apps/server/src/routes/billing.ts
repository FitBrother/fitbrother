import { CreateCheckoutRequestSchema } from "@fitbrother/shared";
import type { FastifyInstance, FastifyReply } from "fastify";
import { activeAccountRequired, authTokenRequired } from "../lib/auth.js";
import { BillingError } from "../services/billing-status.js";
import { createCheckoutUrl, createPortalUrl, getSubscription } from "../services/billing.js";

const STATUS_BY_CODE = {
  already_subscribed: 409,
  no_customer: 404,
  billing_not_configured: 503,
} as const;

function handleBillingError(reply: FastifyReply, err: unknown) {
  if (err instanceof BillingError) {
    return reply.code(STATUS_BY_CODE[err.code]).send({ error: err.code });
  }
  throw err;
}

export async function billingRoutes(app: FastifyInstance) {
  const activeAccount = { preHandler: [authTokenRequired, activeAccountRequired] };

  app.post("/billing/checkout", activeAccount, async (req, reply) => {
    const parsed = CreateCheckoutRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_payload", issues: parsed.error.issues });
    }
    try {
      const url = await createCheckoutUrl(req.user!.id, req.user!.email, parsed.data.interval);
      return reply.send({ url });
    } catch (err) {
      return handleBillingError(reply, err);
    }
  });

  app.post("/billing/portal", activeAccount, async (req, reply) => {
    try {
      return reply.send({ url: await createPortalUrl(req.user!.id) });
    } catch (err) {
      return handleBillingError(reply, err);
    }
  });

  app.get("/billing/subscription", activeAccount, async (req, reply) => {
    return reply.send(await getSubscription(req.user!.id));
  });
}
