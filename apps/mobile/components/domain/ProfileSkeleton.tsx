import { View } from "react-native";
import { SkeletonBlock, SkeletonCircle } from "@/components/Skeleton";
import { shadows } from "@/lib/shadows";

/**
 * Placeholder de tela cheia para o carregamento do perfil.
 *
 * - `variant="own"` espelha `/(app)/profile.tsx`: avatar, nome/username/email
 *   e as duas `MenuSection` (5 + 3 linhas) antes do botão de sair.
 * - `variant="public"` espelha o cabeçalho de `/(app)/users/[id].tsx`: avatar
 *   menor, nome/username, a linha de stats (posts/seguidores/seguindo) e o
 *   botão de seguir — sem seções de configurações, que não existem lá.
 */
export function ProfileSkeleton({ variant = "own" }: { variant?: "own" | "public" }) {
  if (variant === "public") {
    return (
      <View className="gap-4 px-4 pb-2 pt-3">
        <View style={shadows.card} className="items-center rounded-[26px] bg-white p-5">
          <SkeletonCircle size={80} />
          <SkeletonBlock width={140} height={20} radius={4} style={{ marginTop: 12 }} />
          <SkeletonBlock width={90} height={14} radius={4} style={{ marginTop: 6 }} />
          <View className="mt-5 w-full flex-row">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-1 items-center gap-1.5">
                <SkeletonBlock width={28} height={20} radius={4} />
                <SkeletonBlock width={64} height={11} radius={4} />
              </View>
            ))}
          </View>
          <View className="mt-5 w-full">
            <SkeletonBlock width="100%" height={52} radius={26} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-6 px-5 pb-10 pt-3">
      <View className="items-center">
        <SkeletonCircle size={96} />
        <SkeletonBlock width={160} height={22} radius={4} style={{ marginTop: 12 }} />
        <SkeletonBlock width={90} height={14} radius={4} style={{ marginTop: 6 }} />
        <SkeletonBlock width={170} height={14} radius={4} style={{ marginTop: 4 }} />
      </View>

      <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {[0, 1, 2, 3, 4].map((i) => (
          <MenuRowSkeleton key={i} last={i === 4} />
        ))}
      </View>
      <View className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
        {[0, 1, 2].map((i) => (
          <MenuRowSkeleton key={i} last={i === 2} />
        ))}
      </View>

      <SkeletonBlock width="100%" height={52} radius={26} />
    </View>
  );
}

function MenuRowSkeleton({ last = false }: { last?: boolean }) {
  return (
    <View
      className={`min-h-[56px] flex-row items-center px-4 ${last ? "" : "border-b border-neutral-100"}`}
    >
      <SkeletonBlock width={20} height={20} radius={10} />
      <View className="ml-3 flex-1">
        <SkeletonBlock width="50%" height={14} />
      </View>
      <SkeletonBlock width={14} height={14} radius={4} />
    </View>
  );
}
