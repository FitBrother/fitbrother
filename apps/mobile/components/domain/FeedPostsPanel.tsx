import { ActivityIndicator, FlatList, Text, View, useWindowDimensions } from "react-native";
import { PostCard } from "@/components/domain/PostCard";
import { colors } from "@/lib/colors";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { useFeed } from "@/lib/hooks/useFeed";
import { usePostsRealtime } from "@/lib/hooks/usePostsRealtime";

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

  if (feed.isLoading) {
    return (
      <View className="flex-1 items-center justify-center py-10">
        <ActivityIndicator color={colors.primary[400]} />
      </View>
    );
  }

  return (
    <View className="mx-auto w-full flex-1 md:max-w-[900px]">
      <FlatList
        key={numColumns}
        data={feed.data ?? []}
        numColumns={numColumns}
        keyExtractor={(post) => post.id}
        contentContainerClassName="gap-4 px-4 pb-8"
        columnWrapperStyle={numColumns > 1 ? { gap: 16 } : undefined}
        refreshing={feed.isRefetching}
        onRefresh={() => void feed.refetch()}
        ListEmptyComponent={
          <View className="mt-16 items-center px-6">
            <Text className="text-center text-lg font-sans-bold text-neutral-800">
              Seu feed ainda está vazio
            </Text>
            <Text className="mt-2 text-center text-sm font-sans text-neutral-500">
              Siga pessoas e compartilhe uma refeição para ver posts aqui.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="flex-1">
            <PostCard post={item} />
          </View>
        )}
      />
    </View>
  );
}
