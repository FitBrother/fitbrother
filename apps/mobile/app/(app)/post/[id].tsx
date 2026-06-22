import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import type { Comment } from "@fitbrother/shared";
import { Button } from "@/components/Button";
import { PostCard } from "@/components/domain/PostCard";
import { colors } from "@/lib/colors";
import { fetchPost } from "@/lib/api/posts";
import { useAddComment, useComments } from "@/lib/hooks/useComments";

function CommentRow({ comment }: { comment: Comment }) {
  const name = comment.author.username
    ? `@${comment.author.username}`
    : (comment.author.display_name ?? "Alguém");
  return (
    <View className="border-b border-neutral-100 px-4 py-3">
      <Text className="font-sans-semibold text-neutral-800">{name}</Text>
      <Text className="mt-1 text-base font-sans text-neutral-700">{comment.body}</Text>
    </View>
  );
}

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = id ?? "";
  const [draft, setDraft] = useState("");

  const postQuery = useQuery({
    queryKey: ["post", postId],
    queryFn: () => fetchPost(postId),
    enabled: Boolean(postId),
  });
  const commentsQuery = useComments(postId);
  const addComment = useAddComment(postId);

  function send() {
    const body = draft.trim();
    if (!body) return;
    addComment.mutate(body, { onSuccess: () => setDraft("") });
  }

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
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Post</Text>
      </View>

      <FlatList
        data={commentsQuery.data ?? []}
        keyExtractor={(c: Comment) => c.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListHeaderComponent={
          <View className="gap-3 p-4">
            {postQuery.data ? <PostCard post={postQuery.data} /> : null}
            <Text className="px-1 font-sans-semibold text-neutral-800">Comentários</Text>
          </View>
        }
        ListEmptyComponent={
          !commentsQuery.isLoading ? (
            <Text className="px-4 font-sans text-neutral-500">Seja o primeiro a comentar.</Text>
          ) : null
        }
        renderItem={({ item }) => <CommentRow comment={item} />}
      />

      <View className="flex-row items-end gap-2 border-t border-neutral-100 bg-white px-4 py-3">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={500}
          placeholder="Escreva um comentário..."
          placeholderTextColor={colors.neutral[400]}
          className="max-h-24 flex-1 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-base font-sans text-neutral-800"
          textAlignVertical="top"
        />
        <Button
          label="Enviar"
          variant="primary"
          loading={addComment.isPending}
          disabled={!draft.trim() || addComment.isPending}
          onPress={send}
        />
      </View>
    </SafeAreaView>
  );
}
