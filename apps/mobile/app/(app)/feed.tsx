import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { PostCard } from "@/components/domain/PostCard";
import { colors } from "@/lib/colors";
import { useFeed } from "@/lib/hooks/useFeed";

export default function FeedScreen() {
  const router = useRouter();
  const feed = useFeed();

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Feed</Text>
      </View>

      {feed.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary[400]} />
        </View>
      ) : (
        <FlatList
          data={feed.data ?? []}
          keyExtractor={(post) => post.id}
          contentContainerClassName="gap-4 px-4 pb-8"
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
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}
    </SafeAreaView>
  );
}
