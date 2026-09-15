import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Comment } from "@fitbrother/shared";
import { CommentComposer } from "@/components/domain/CommentComposer";
import { CommentRow } from "@/components/domain/CommentRow";
import { CommentRowSkeleton } from "@/components/domain/CommentRowSkeleton";
import { PostCard } from "@/components/domain/PostCard";
import { colors } from "@/lib/colors";
import { useAddComment, useComments } from "@/lib/hooks/useComments";
import { usePost } from "@/lib/hooks/usePost";

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id ?? "";

  const postQuery = usePost(postId);
  const commentsQuery = useComments(postId);
  const addComment = useAddComment(postId);
  const comments = commentsQuery.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Post</Text>
      </View>

      <FlatList
        data={comments}
        keyExtractor={(c: Comment) => c.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <View className="gap-3 p-4">
            {postQuery.data ? <PostCard post={postQuery.data} /> : null}
            {/* A contagem no título evita que a pessoa role até o fim só para
                descobrir quantos comentários existem. */}
            <Text className="px-1 font-sans-semibold text-neutral-800">
              {comments.length > 0 ? `Comentários (${comments.length})` : "Comentários"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          commentsQuery.isLoading ? (
            <View className="gap-1">
              <CommentRowSkeleton />
              <CommentRowSkeleton />
              <CommentRowSkeleton />
              <CommentRowSkeleton />
            </View>
          ) : (
            <View className="px-6 py-6">
              <Text className="text-center font-sans text-sm text-neutral-500">
                Nenhum comentário ainda. Seja a primeira pessoa a responder.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <CommentRow comment={item} />}
      />

      <CommentComposer sending={addComment.isPending} onSend={(body) => addComment.mutate(body)} />
    </SafeAreaView>
  );
}
