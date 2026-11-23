import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useState } from "react";
import { Platform } from "react-native";
import type { BillingInterval } from "@fitbrother/shared";
import { createCheckout, createPortal } from "@/lib/api/billing";
import { checkoutHref, embeddedCheckoutSupported } from "@/lib/billing-checkout";
import { billingErrorMessage, BILLING_UNAVAILABLE_MESSAGE } from "@/lib/billing-errors";
import { subscriptionKey } from "@/lib/hooks/useSubscription";
import { useToast } from "@/lib/toast/toast-context";

export function useBillingActions() {
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const openUrl = useCallback(
    async (url: string) => {
      await WebBrowser.openBrowserAsync(url);
      await qc.invalidateQueries({ queryKey: subscriptionKey });
    },
    [qc],
  );

  const portal = useCallback(async () => {
    const { url } = await createPortal();
    await openUrl(url);
  }, [openUrl]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setPending(true);
      try {
        await action();
      } catch (err) {
        const message = billingErrorMessage(err instanceof Error ? err.message : "");
        if (message === null) {
          try {
            await portal();
          } catch {
            toast({ variant: "error", message: BILLING_UNAVAILABLE_MESSAGE });
          }
        } else {
          toast({ variant: "error", message });
        }
      } finally {
        setPending(false);
      }
    },
    [portal, toast],
  );

  const startCheckout = useCallback(
    async (interval: BillingInterval) => {
      if (embeddedCheckoutSupported(Platform.OS)) {
        router.push(checkoutHref(interval) as never);
        return;
      }
      await run(async () => {
        const { url } = await createCheckout(interval);
        await openUrl(url);
      });
    },
    [run, openUrl, router],
  );

  const openPortal = useCallback(() => run(portal), [run, portal]);

  return { startCheckout, openPortal, pending };
}
