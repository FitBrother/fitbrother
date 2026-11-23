import Stripe from "stripe";
import { BillingError } from "../services/billing-status.js";
import { env } from "./env.js";

let _stripe: Stripe | null = null;

export function stripeClient(): Stripe {
  if (_stripe) return _stripe;
  if (!env.STRIPE_SECRET_KEY) throw new BillingError("billing_not_configured");
  _stripe = new Stripe(env.STRIPE_SECRET_KEY);
  return _stripe;
}
