import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";

export function CheckoutSkeleton() {
  return (
    <View className="mx-auto w-full max-w-[560px] gap-4 px-5 py-6">
      <SkeletonBlock width="60%" height={28} radius={8} />
      <SkeletonBlock width="100%" height={72} radius={16} />
      <SkeletonBlock width="100%" height={260} radius={16} />
      <SkeletonBlock width="100%" height={52} radius={26} />
    </View>
  );
}
