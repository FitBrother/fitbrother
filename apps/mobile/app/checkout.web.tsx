import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { CheckoutSkeleton } from "@/components/domain/CheckoutSkeleton";
import { createEmbeddedCheckout } from "@/lib/api/billing";
import { colors } from "@/lib/colors";
import { checkoutErrorMessage, parseInterval } from "@/lib/checkout-state";

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

type State =
  | { status: "loading" }
  | { status: "ready"; clientSecret: string }
  | { status: "error"; message: string };

async function loadCheckout(interval: "month" | "year"): Promise<string> {
  if (!stripePromise) throw new Error("billing_not_configured");
  const [stripe, clientSecret] = await Promise.all([
    stripePromise,
    createEmbeddedCheckout(interval),
  ]);
  if (!stripe) throw new Error("stripe_js_unavailable");
  return clientSecret;
}

export default function Checkout() {
  const router = useRouter();
  const { interval: rawInterval } = useLocalSearchParams<{ interval?: string }>();
  const interval = parseInterval(rawInterval);
  const [state, setState] = useState<State>({ status: "loading" });
  const request = useRef<{ interval: string; promise: Promise<string> } | null>(null);

  useEffect(() => {
    if (!interval) return;
    if (request.current?.interval !== interval) {
      request.current = { interval, promise: loadCheckout(interval) };
    }
    let active = true;
    request.current.promise.then(
      (clientSecret) => active && setState({ status: "ready", clientSecret }),
      (err: unknown) =>
        active &&
        setState({
          status: "error",
          message: checkoutErrorMessage(err instanceof Error ? err.message : ""),
        }),
    );
    return () => {
      active = false;
    };
  }, [interval]);

  const options = useMemo(
    () => (state.status === "ready" ? { fetchClientSecret: async () => state.clientSecret } : null),
    [state],
  );

  if (!interval) return <Redirect href="/" />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="mx-auto w-full max-w-[560px] flex-row items-center px-3 py-2">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ArrowLeft size={24} color={colors.neutral[900]} />
        </Pressable>
        <Text className="ml-1 font-display-bold text-xl text-neutral-900">
          Assinar Fitbrother Premium
        </Text>
      </View>
      {state.status === "loading" && <CheckoutSkeleton />}
      {state.status === "error" && (
        <View className="mx-auto w-full max-w-[560px] gap-6 px-5 py-10">
          <Text className="text-center font-sans-medium text-base text-neutral-900">
            {state.message}
          </Text>
          <Button label="Voltar" variant="outline" onPress={goBack} accessibilityRole="button" />
        </View>
      )}
      {options && (
        <ScrollView contentContainerClassName="mx-auto w-full max-w-[560px] px-2 pb-10">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
