import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PublicProfile } from "@fitbrother/shared";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "@/components/Input";
import { followUser, unfollowUser } from "@/lib/api/users";
import { colors } from "@/lib/colors";
import { followingKey, useFollowing } from "@/lib/hooks/useFollowing";
import { leaderboardKey } from "@/lib/hooks/useWeeklyLeaderboard";
import { useUserSearch } from "@/lib/hooks/useUserSearch";

type FollowMutationInput = {
  userId: string;
  fullName: string | null;
};

type FollowMutationContext = {
  previousFollowing?: Array<{ user_id: string; full_name: string | null }>;
};

type UnfollowMutationContext = {
  previousFollowing?: Array<{ user_id: string; full_name: string | null }>;
};

function displayName(user: PublicProfile): string {
  return user.display_name?.trim() || (user.username ? `@${user.username}` : "Fitbrother");
}

export default function UserSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data: users, isFetching } = useUserSearch(q);
  const { data: following } = useFollowing();
  const queryClient = useQueryClient();
  const follow = useMutation({
    mutationFn: ({ userId }: FollowMutationInput) => followUser(userId),
    onMutate: async ({ userId, fullName }): Promise<FollowMutationContext> => {
      await queryClient.cancelQueries({ queryKey: followingKey });

      const previousFollowing =
        queryClient.getQueryData<Array<{ user_id: string; full_name: string | null }>>(
          followingKey,
        );

      queryClient.setQueryData<Array<{ user_id: string; full_name: string | null }>>(
        followingKey,
        (current = []) => {
          if (current.some((user) => user.user_id === userId)) return current;
          return [...current, { user_id: userId, full_name: fullName }];
        },
      );

      return { previousFollowing };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previousFollowing) {
        queryClient.setQueryData(followingKey, ctx.previousFollowing);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followingKey, refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: leaderboardKey, refetchType: "all" }),
      ]);
    },
  });
  const unfollow = useMutation({
    mutationFn: (userId: string) => unfollowUser(userId),
    onMutate: async (userId): Promise<UnfollowMutationContext> => {
      await queryClient.cancelQueries({ queryKey: followingKey });

      const previousFollowing =
        queryClient.getQueryData<Array<{ user_id: string; full_name: string | null }>>(
          followingKey,
        );

      queryClient.setQueryData<Array<{ user_id: string; full_name: string | null }>>(
        followingKey,
        (current = []) => current.filter((user) => user.user_id !== userId),
      );

      return { previousFollowing };
    },
    onError: (_error, _vars, ctx) => {
      if (ctx?.previousFollowing) {
        queryClient.setQueryData(followingKey, ctx.previousFollowing);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followingKey, refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: leaderboardKey, refetchType: "all" }),
      ]);
    },
  });
  const followedIds = useMemo(() => {
    const ids = new Set((following ?? []).map((user) => user.user_id));
    return ids;
  }, [following]);

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
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Buscar pessoas</Text>
      </View>

      <View className="px-4 pt-2">
        <Input
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Buscar por @username"
        />
      </View>

      <FlatList
        contentContainerClassName="px-4 pb-8"
        data={users ?? []}
        keyExtractor={(item: PublicProfile) => item.user_id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          q.trim().length >= 2 && !isFetching ? (
            <Text className="mt-6 text-center font-sans text-neutral-500">Ninguém encontrado.</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const isFollowing = followedIds.has(item.user_id);
          const isPendingThisUser = follow.isPending && follow.variables?.userId === item.user_id;
          const isPendingUnfollow = unfollow.isPending && unfollow.variables === item.user_id;
          const isBusy = isPendingThisUser || isPendingUnfollow;
          return (
            <View className="min-h-[68px] flex-row items-center justify-between border-b border-neutral-100 py-3">
              <View className="flex-1 pr-3">
                <Text className="text-base font-sans-semibold text-neutral-800">
                  {displayName(item)}
                </Text>
                <Text className="text-sm font-sans text-neutral-500">@{item.username}</Text>
              </View>
              <Pressable
                onPress={() => {
                  if (isFollowing) {
                    unfollow.mutate(item.user_id);
                    return;
                  }
                  follow.mutate({
                    userId: item.user_id,
                    fullName: item.display_name ?? null,
                  });
                }}
                disabled={isBusy}
                accessibilityRole="button"
                accessibilityLabel={
                  isFollowing ? `Deixar de seguir ${item.username}` : `Seguir ${item.username}`
                }
                className={`min-h-[44px] min-w-[44px] items-center justify-center rounded-full px-4 ${
                  isFollowing ? "border border-neutral-200 bg-white" : "bg-primary-400"
                }`}
              >
                <Text
                  className={`font-sans-semibold ${
                    isFollowing ? "text-neutral-700" : "text-white"
                  }`}
                >
                  {isBusy ? "..." : isFollowing ? "Seguindo" : "Seguir"}
                </Text>
              </Pressable>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
