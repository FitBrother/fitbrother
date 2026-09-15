import { View } from "react-native";
import { SkeletonBlock } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Espelha o card de confirmação de produto de `scan-confirm.tsx`: foto +
 * nome/marca, e as quatro linhas de "Macros Estimados". Usado tanto na busca
 * do código de barras quanto na espera da extração por IA (produto não
 * encontrado na base) — o texto de status em cada caso fica a cargo da tela.
 */
export function ScanResultSkeleton() {
  return (
    <View className="w-full max-w-sm gap-4 px-6">
      <View style={shadows.card} className="rounded-[26px] bg-white p-5">
        <View className="flex-row items-center gap-4">
          <SkeletonBlock width={64} height={64} radius={12} />
          <View className="flex-1 gap-1.5">
            <SkeletonBlock width="80%" height={18} />
            <SkeletonBlock width="45%" height={13} />
          </View>
        </View>
      </View>

      <View style={shadows.card} className="gap-3 rounded-[26px] bg-white p-5">
        <SkeletonBlock width={140} height={16} />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="flex-row items-center justify-between">
            <SkeletonBlock width={90} height={13} />
            <SkeletonBlock width={56} height={13} />
          </View>
        ))}
      </View>
    </View>
  );
}
