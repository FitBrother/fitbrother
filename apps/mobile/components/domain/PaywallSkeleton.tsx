import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";

export function PaywallSkeleton() {
  return (
    <View className="mx-auto w-full max-w-[560px] flex-1 px-5 py-6">
      <View className="mt-7 gap-3">
        <SkeletonBlock width="80%" height={36} radius={8} />
        <SkeletonBlock width="100%" height={16} radius={4} />
        <SkeletonBlock width="70%" height={16} radius={4} />
      </View>
      <View className="mt-10 gap-3">
        <SkeletonBlock width="100%" height={60} radius={30} />
        <SkeletonBlock width="100%" height={60} radius={30} />
        <SkeletonBlock width="100%" height={52} radius={26} />
      </View>
    </View>
  );
}
