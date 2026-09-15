import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * "Casca" genérica do app: barra de topo (avatar + título) + cards vazios.
 * Usado no callback de OAuth (auth-callback.tsx), onde o destino final
 * ainda é desconhecido. Os gates de auth/perfil (app/index.tsx,
 * (app)/_layout.tsx) usam `HomeSkeleton` em vez deste — a Home é o destino
 * esmagador da maioria dos acessos, e reaproveitar sua forma evita um
 * flash de dois formatos de skeleton diferentes em sequência.
 */
export function AppShellSkeleton() {
  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center gap-3 px-4 pt-2">
        <SkeletonCircle size={40} />
        <SkeletonBlock width={120} height={16} />
      </View>
      <View className="gap-3 px-4 pt-6">
        <View style={shadows.card} className="h-28 rounded-[26px] bg-white p-4">
          <SkeletonBlock width="70%" height={14} />
        </View>
        <View style={shadows.card} className="h-28 rounded-[26px] bg-white p-4">
          <SkeletonBlock width="60%" height={14} />
        </View>
        <View style={shadows.card} className="h-28 rounded-[26px] bg-white p-4">
          <SkeletonBlock width="50%" height={14} />
        </View>
      </View>
    </SafeAreaView>
  );
}
