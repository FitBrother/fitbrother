import { useMemo } from "react";
import { FlatList, Text, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import type { Post } from "@fitbrother/shared";
import { Button } from "@/components/Button";
import { FeedPostSkeleton } from "@/components/domain/FeedPostSkeleton";
import { PostCard } from "@/components/domain/PostCard";
import { PullToRefresh } from "@/components/PullToRefresh";
import { colors } from "@/lib/colors";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useFeed } from "@/lib/hooks/useFeed";
import { usePostsRealtime } from "@/lib/hooks/usePostsRealtime";
import { feedSection, SECTION_LABEL, type FeedSection } from "@/lib/social/post-format";

/**
 * Item da lista: ou um cabeçalho de seção, ou um post.
 *
 * Uma FlatList única com os dois tipos, em vez de uma SectionList: o layout em
 * duas colunas do desktop (`numColumns`) não existe na SectionList, e o feed
 * precisa dos dois.
 */
type FeedRow =
  | { kind: "header"; key: string; label: string }
  | { kind: "post"; key: string; post: Post };

/**
 * Intercala cabeçalhos de recência entre os posts.
 *
 * Sem eles, um post de duas horas atrás e um de cinco dias têm exatamente o
 * mesmo peso na tela — o feed vira uma pilha sem tempo, e o usuário não
 * consegue saber se já viu tudo que é novo. O agrupamento é o que transforma
 * a lista em cronologia.
 */
function withSectionHeaders(posts: Post[], now: number = Date.now()): FeedRow[] {
  const rows: FeedRow[] = [];
  let atual: FeedSection | null = null;

  for (const post of posts) {
    const secao = feedSection(post.created_at, now);
    if (secao !== atual) {
      atual = secao;
      rows.push({ kind: "header", key: `h-${secao}`, label: SECTION_LABEL[secao] });
    }
    rows.push({ kind: "post", key: post.id, post });
  }
  return rows;
}

function FeedEmptyState() {
  const router = useRouter();

  return (
    <View className="mt-16 items-center px-6">
      <Text className="text-center text-lg font-sans-bold text-neutral-800">
        Nada por aqui ainda
      </Text>
      {/* A tela vazia é um convite, não um comunicado. A versão anterior
          explicava o que faltava ("siga pessoas e compartilhe") sem dar como
          fazer nenhuma das duas — deixava o usuário num beco. */}
      <Text className="mt-2 text-center text-sm font-sans text-neutral-500">
        Siga alguém para ver as refeições e conquistas dessa pessoa aqui.
      </Text>
      <View className="mt-5 w-full max-w-[260px]">
        <Button
          label="Buscar pessoas"
          onPress={() => router.push("/(app)/users/search" as never)}
          accessibilityLabel="Buscar pessoas"
          accessibilityRole="button"
          leftIcon={<Search size={18} color={colors.neutral[900]} />}
        />
      </View>
    </View>
  );
}

/**
 * Lista de posts do Feed — extraída de app/(app)/feed.tsx pra ser
 * reaproveitada tanto na rota própria (desktop, via Sidebar) quanto embutida
 * na sub-aba "Publicações" dentro do Feed no mobile.
 */
export function FeedPostsPanel() {
  const feed = useFeed();
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;
  usePostsRealtime(userId);
  const { width } = useWindowDimensions();
  const numColumns = width >= 768 ? 2 : 1;

  // Cabeçalho de seção só na coluna única. Em duas colunas a FlatList trataria
  // o cabeçalho como mais uma célula da grade — ele ocuparia metade da linha,
  // com um post do lado, e deixaria de significar "daqui pra baixo é ontem".
  //
  // O `?? []` mora DENTRO do useMemo: fora dele, cada render criaria um array
  // novo e a dependência mudaria sempre, remontando a lista inteira à toa.
  const rows = useMemo(() => {
    const posts = feed.data ?? [];
    return numColumns === 1
      ? withSectionHeaders(posts)
      : posts.map((post): FeedRow => ({ kind: "post", key: post.id, post }));
  }, [feed.data, numColumns]);

  if (feed.isLoading) {
    return (
      <View className="mx-auto w-full flex-1 gap-4 px-4 pb-8 pt-2 md:max-w-[900px]">
        <FeedPostSkeleton />
        <FeedPostSkeleton />
        <FeedPostSkeleton />
        <FeedPostSkeleton />
      </View>
    );
  }

  return (
    <View className="mx-auto w-full flex-1 md:max-w-[900px]">
      <PullToRefresh onRefresh={() => feed.refetch()}>
        <FlatList
          key={numColumns}
          data={rows}
          numColumns={numColumns}
          keyExtractor={(row) => row.key}
          contentContainerClassName="gap-4 px-4 pb-8"
          columnWrapperStyle={numColumns > 1 ? { gap: 16 } : undefined}
          refreshing={feed.isRefetching}
          onRefresh={() => void feed.refetch()}
          ListEmptyComponent={<FeedEmptyState />}
          renderItem={({ item }) =>
            item.kind === "header" ? (
              <View className="flex-1 pt-2">
                <Text className="font-sans-semibold text-xs uppercase tracking-wide text-neutral-400">
                  {item.label}
                </Text>
              </View>
            ) : (
              <View className="flex-1">
                <PostCard post={item.post} />
              </View>
            )
          }
        />
      </PullToRefresh>
    </View>
  );
}

export { withSectionHeaders };
