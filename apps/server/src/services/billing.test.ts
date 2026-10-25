import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const mockEnv = vi.hoisted(() => ({
  APP_URL: "https://app.test",
  STRIPE_PRICE_MONTHLY: "price_month",
  STRIPE_PRICE_ANNUAL: "price_year",
  STRIPE_TRIAL_DAYS: 7,
  STRIPE_SECRET_KEY: "",
}));
vi.mock("../lib/env.js", () => ({ env: mockEnv }));

import {
  cancelUserSubscription,
  createCheckoutUrl,
  createPortalUrl,
  getSubscription,
  type BillingDeps,
  type BillingRow,
} from "./billing.js";
import { BillingError } from "./billing-status.js";

const USER = "user-1";

type Params = {
  mode: string;
  line_items: unknown;
  client_reference_id: string;
  metadata: unknown;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  return_url: string;
  subscription_data: { trial_period_days?: number };
};

function row(extra: Partial<BillingRow> = {}): BillingRow {
  return {
    plan: "free",
    status: "active",
    stripe_customer_id: null,
    provider_subscription_id: null,
    current_period_end: null,
    ...extra,
  };
}

function makeDeps(initial: BillingRow | null) {
  const customersCreate = vi.fn(async () => ({ id: "cus_new" }));
  const sessionsCreate = vi.fn(async (_p: Record<string, unknown>) => ({
    url: "https://checkout.test/s",
  }));
  const portalCreate = vi.fn(async (_p: Record<string, unknown>) => ({
    url: "https://portal.test/p",
  }));
  const saveCustomerId = vi.fn(async () => {});
  const subscriptionsCancel = vi.fn(async (_id: string) => ({}));
  const deps: BillingDeps = {
    stripe: {
      customers: { create: customersCreate },
      checkout: { sessions: { create: sessionsCreate } },
      billingPortal: { sessions: { create: portalCreate } },
      subscriptions: { cancel: subscriptionsCancel },
    } as unknown as Stripe,
    store: { getRow: async () => initial, saveCustomerId },
  };
  return {
    deps,
    customersCreate,
    sessionsCreate,
    portalCreate,
    saveCustomerId,
    subscriptionsCancel,
  };
}

beforeEach(() => {
  mockEnv.STRIPE_TRIAL_DAYS = 7;
  mockEnv.STRIPE_SECRET_KEY = "";
});

describe("createCheckoutUrl", () => {
  it("creates the customer and saves it on first checkout", async () => {
    const m = makeDeps(row());
    const url = await createCheckoutUrl(USER, "a@b.co", "month", m.deps);
    expect(url).toBe("https://checkout.test/s");
    expect(m.customersCreate).toHaveBeenCalledWith({
      email: "a@b.co",
      metadata: { user_id: USER },
    });
    expect(m.saveCustomerId).toHaveBeenCalledWith(USER, "cus_new");
    expect(m.sessionsCreate.mock.calls[0]![0]).toMatchObject({ customer: "cus_new" });
  });

  it("creates the customer when no row exists", async () => {
    const m = makeDeps(null);
    await createCheckoutUrl(USER, null, "month", m.deps);
    expect(m.customersCreate).toHaveBeenCalledWith({ metadata: { user_id: USER } });
    expect(m.saveCustomerId).toHaveBeenCalledWith(USER, "cus_new");
  });

  it("reuses an existing customer", async () => {
    const m = makeDeps(row({ stripe_customer_id: "cus_old" }));
    await createCheckoutUrl(USER, "a@b.co", "month", m.deps);
    expect(m.customersCreate).not.toHaveBeenCalled();
    expect(m.saveCustomerId).not.toHaveBeenCalled();
    expect(m.sessionsCreate.mock.calls[0]![0]).toMatchObject({ customer: "cus_old" });
  });

  it.each([
    ["month", "price_month"],
    ["year", "price_year"],
  ] as const)("builds the session for interval %s", async (interval, price) => {
    const m = makeDeps(row());
    await createCheckoutUrl(USER, "a@b.co", interval, m.deps);
    const p = m.sessionsCreate.mock.calls[0]![0] as Params;
    expect(p.mode).toBe("subscription");
    expect(p.line_items).toEqual([{ price, quantity: 1 }]);
    expect(p.client_reference_id).toBe(USER);
    expect(p.metadata).toEqual({ user_id: USER });
    expect(p.success_url).toMatch(/^https:\/\/app\.test\/billing-return/);
    expect(p.cancel_url).toMatch(/^https:\/\/app\.test\/billing-return/);
    expect(p.customer_email).toBeUndefined();
  });

  it("adds the trial only when configured and never subscribed before", async () => {
    const first = makeDeps(row());
    await createCheckoutUrl(USER, null, "month", first.deps);
    expect(first.sessionsCreate.mock.calls[0]![0]).toMatchObject({
      subscription_data: { trial_period_days: 7 },
    });

    const again = makeDeps(row({ status: "canceled", provider_subscription_id: "sub_1" }));
    await createCheckoutUrl(USER, null, "month", again.deps);
    expect(
      (again.sessionsCreate.mock.calls[0]![0] as Params).subscription_data.trial_period_days,
    ).toBeUndefined();

    mockEnv.STRIPE_TRIAL_DAYS = 0;
    const off = makeDeps(row());
    await createCheckoutUrl(USER, null, "month", off.deps);
    expect(
      (off.sessionsCreate.mock.calls[0]![0] as Params).subscription_data.trial_period_days,
    ).toBeUndefined();
  });

  it.each(["active", "trialing", "past_due"] as const)("rejects %s subscribers", async (status) => {
    const m = makeDeps(row({ plan: "pro", status, stripe_customer_id: "cus_old" }));
    await expect(createCheckoutUrl(USER, null, "month", m.deps)).rejects.toMatchObject({
      code: "already_subscribed",
    });
    expect(m.customersCreate).not.toHaveBeenCalled();
    expect(m.sessionsCreate).not.toHaveBeenCalled();
  });

  it("does not block free users with default active status", async () => {
    const m = makeDeps(row({ plan: "free", status: "active" }));
    await expect(createCheckoutUrl(USER, null, "month", m.deps)).resolves.toBeTruthy();
  });
});

describe("createPortalUrl", () => {
  it("throws no_customer without a customer id", async () => {
    const m = makeDeps(row());
    await expect(createPortalUrl(USER, m.deps)).rejects.toBeInstanceOf(BillingError);
    await expect(createPortalUrl(USER, m.deps)).rejects.toMatchObject({ code: "no_customer" });
    expect(m.portalCreate).not.toHaveBeenCalled();
  });

  it("creates a portal session for the customer", async () => {
    const m = makeDeps(row({ stripe_customer_id: "cus_old" }));
    await expect(createPortalUrl(USER, m.deps)).resolves.toBe("https://portal.test/p");
    expect(m.portalCreate.mock.calls[0]![0]).toMatchObject({ customer: "cus_old" });
    expect((m.portalCreate.mock.calls[0]![0] as Params).return_url).toMatch(
      /^https:\/\/app\.test\//,
    );
  });
});

describe("getSubscription", () => {
  it("returns free/active without a row", async () => {
    const m = makeDeps(null);
    await expect(getSubscription(USER, m.deps)).resolves.toEqual({
      plan: "free",
      status: "active",
      current_period_end: null,
      has_customer: false,
    });
  });

  it("maps the row and has_customer", async () => {
    const m = makeDeps(
      row({
        plan: "pro",
        status: "trialing",
        stripe_customer_id: "cus_1",
        current_period_end: "2026-11-01T00:00:00.000Z",
      }),
    );
    await expect(getSubscription(USER, m.deps)).resolves.toEqual({
      plan: "pro",
      status: "trialing",
      current_period_end: "2026-11-01T00:00:00.000Z",
      has_customer: true,
    });
    const none = makeDeps(row());
    expect((await getSubscription(USER, none.deps)).has_customer).toBe(false);
  });
});

describe("cancelUserSubscription", () => {
  const subscribed = () =>
    row({ plan: "pro", stripe_customer_id: "cus_1", provider_subscription_id: "sub_1" });

  it("does nothing without a row", async () => {
    const m = makeDeps(null);
    await expect(cancelUserSubscription(USER, m.deps)).resolves.toBeUndefined();
    expect(m.subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("does nothing without a subscription id", async () => {
    const m = makeDeps(row({ stripe_customer_id: "cus_1" }));
    await cancelUserSubscription(USER, m.deps);
    expect(m.subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("does nothing without a customer id", async () => {
    const m = makeDeps(row({ provider_subscription_id: "sub_1" }));
    await cancelUserSubscription(USER, m.deps);
    expect(m.subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("cancels the subscription by id", async () => {
    const m = makeDeps(subscribed());
    await cancelUserSubscription(USER, m.deps);
    expect(m.subscriptionsCancel).toHaveBeenCalledTimes(1);
    expect(m.subscriptionsCancel).toHaveBeenCalledWith("sub_1");
  });

  it("swallows resource_missing", async () => {
    const m = makeDeps(subscribed());
    m.subscriptionsCancel.mockRejectedValueOnce(
      Object.assign(new Error("No such subscription"), { code: "resource_missing" }),
    );
    await expect(cancelUserSubscription(USER, m.deps)).resolves.toBeUndefined();
  });

  it("propagates other errors", async () => {
    const m = makeDeps(subscribed());
    m.subscriptionsCancel.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { code: "api_connection_error" }),
    );
    await expect(cancelUserSubscription(USER, m.deps)).rejects.toThrow("boom");
    m.subscriptionsCancel.mockRejectedValueOnce(new Error("plain"));
    await expect(cancelUserSubscription(USER, m.deps)).rejects.toThrow("plain");
  });

  describe("with Stripe not configured", () => {
    const storeOnly = (r: BillingRow | null) => ({
      store: { getRow: async () => r, saveCustomerId: async () => {} },
    });

    it("is a no-op for a missing row", async () => {
      mockEnv.STRIPE_SECRET_KEY = "";
      await expect(cancelUserSubscription(USER, storeOnly(null))).resolves.toBeUndefined();
    });

    it("is a no-op without a customer id", async () => {
      mockEnv.STRIPE_SECRET_KEY = "";
      const r = row({ provider_subscription_id: "sub_1" });
      await expect(cancelUserSubscription(USER, storeOnly(r))).resolves.toBeUndefined();
    });

    it("fails with billing_not_configured for a subscribed user", async () => {
      mockEnv.STRIPE_SECRET_KEY = "";
      const r = row({ stripe_customer_id: "cus_1", provider_subscription_id: "sub_1" });
      await expect(cancelUserSubscription(USER, storeOnly(r))).rejects.toMatchObject({
        code: "billing_not_configured",
      });
    });
  });
});
