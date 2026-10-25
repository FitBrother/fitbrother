import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { PaywallSkeleton } from "@/components/domain/PaywallSkeleton";
import { subscriptionKey } from "@/lib/hooks/useSubscription";

export default function BillingReturn() {
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    void qc.invalidateQueries({ queryKey: subscriptionKey });
    router.replace("/");
  }, [qc, router]);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <PaywallSkeleton />
    </SafeAreaView>
  );
}
