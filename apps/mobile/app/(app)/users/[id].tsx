import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Flame, Lock } from "lucide-react-native";
import { FlatList, Pressable, SafeAreaView, Text, View } from "react-native";
import type { Post } from "@fitbrother/shared";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { PostCard } from "@/components/domain/PostCard";
import { ProfileSkeleton } from "@/components/domain/ProfileSkeleton";
import { profileInitials } from "@/lib/account-utils";
import { followUser, unfollowUser } from "@/lib/api/users";
import { colors } from "@/lib/colors";
import { followingKey } from "@/lib/hooks/useFollowing";
import { publicProfileKeyFor, usePublicProfile } from "@/lib/hooks/usePublicProfile";
import { leaderboardKey } from "@/lib/hooks/useWeeklyLeaderboard";
import { backOrHome } from "@/lib/navigation";
import { shadows } from "@/lib/shadows";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="flex-1 items-center">
      <Text style={NUM} className="text-xl font-display-bold text-neutral-800">
        {value}
      </Text>
      <Text className="mt-0.5 font-sans text-xs text-neutral-500">{label}</Text>
    </View>
  );
}

/**
 * Perfil público de outra pessoa.
 *
 * Existe porque o feed não tinha para onde levar: dava para ver o post de
 * alguém e não dava para ver quem é a pessoa nem seguir a partir dali — o
 * único caminho para seguir era adivinhar o @username na busca.
 */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = usePublicProfile(id);

  const alternarSeguir = useMutation({
    mutationFn: (seguindo: boolean) => (seguindo ? unfollowUser(id!) : followUser(id!)),
    onSettled: async () => {
      await Promise.all([
        // O perfil em si muda (contagens e liberação dos posts), e as duas
        // listas que dependem de quem se segue também.
        queryClient.invalidateQueries({ queryKey: publicProfileKeyFor(id ?? "") }),
        queryClient.invalidateQueries({ queryKey: followingKey, refetchType: "all" }),
        queryClient.invalidateQueries({ queryKey: leaderboardKey, refetchType: "all" }),
      ]);
    },
  });

  const nome = data?.profile.display_name?.trim() || "Fitbrother";
  const username = data?.profile.username ? `@${data.profile.username}` : null;

  const cabecalho = data ? (
    <View className="gap-4 pb-2">
      <View style={shadows.card} className="items-center rounded-[26px] bg-white p-5">
        <Avatar
          uri={data.profile.avatar_url}
          initials={profileInitials(data.profile.display_name, data.profile.username)}
          size={80}
          accessibilityLabel={`Foto de ${nome}`}
        />
        <Text className="mt-3 text-xl font-display-bold text-neutral-800">{nome}</Text>
        {username ? (
          <Text className="mt-0.5 font-sans text-sm text-neutral-500">{username}</Text>
        ) : null}

        {data.current_streak > 0 ? (
          <View className="mt-3 flex-row items-center gap-1.5 rounded-full bg-streak-50 px-3 py-1.5">
            <Flame size={16} color={colors.streak[500]} />
            <Text style={NUM} className="font-sans-semibold text-sm text-streak-600">
              {data.current_streak} {data.current_streak === 1 ? "dia" : "dias"} de ofensiva
            </Text>
          </View>
        ) : null}

        <View className="mt-5 w-full flex-row">
          <Stat
            value={data.post_count}
            label={data.post_count === 1 ? "publicação" : "publicações"}
          />
          <Stat value={data.follower_count} label="seguidores" />
          <Stat value={data.following_count} label="seguindo" />
        </View>

        {/* Nada de botão de seguir no próprio perfil — seguir a si mesmo é
            rejeitado pelo servidor (`cannot_follow_self`), então mostrar o
            botão seria oferecer uma ação que só pode falhar. */}
        {!data.is_me ? (
          <View className="mt-5 w-full">
            <Button
              label={data.is_following ? "Deixar de seguir" : "Seguir"}
              variant={data.is_following ? "outline" : "primary"}
              loading={alternarSeguir.isPending}
              disabled={alternarSeguir.isPending}
              onPress={() => alternarSeguir.mutate(data.is_following)}
              accessibilityRole="button"
              accessibilityLabel={data.is_following ? `Deixar de seguir ${nome}` : `Seguir ${nome}`}
            />
          </View>
        ) : null}
      </View>

      {/* Não seguir não é "perfil vazio": o `post_count` acima já disse quantas
          publicações existem. Aqui explicamos por que elas não aparecem e o
          que fazer — o botão de seguir está logo acima. */}
      {!data.is_me && !data.is_following ? (
        <View className="items-center gap-2 rounded-[26px] bg-neutral-100 px-6 py-8">
          <Lock size={20} color={colors.neutral[400]} />
          <Text className="text-center font-sans-semibold text-neutral-700">
            Publicações são de quem segue
          </Text>
          <Text className="text-center font-sans text-sm text-neutral-500">
            Siga {nome} para ver as refeições e conquistas dessa pessoa.
          </Text>
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => backOrHome(router)}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        {/* No próprio perfil o título repete o nome da ação que trouxe até
            aqui ("Ver perfil público", em /profile). Com os dois chamados
            "Perfil", nada na tela distinguia esta da tela de conta. */}
        <Text className="ml-2 text-xl font-display-bold text-neutral-800" numberOfLines={1}>
          {data?.is_me ? "Seu perfil público" : "Perfil"}
        </Text>
      </View>

      {isLoading ? (
        <ProfileSkeleton variant="public" />
      ) : isError || !data ? (
        <View className="flex-1 items-center justify-center gap-2 px-6">
          <Text className="text-center font-sans-semibold text-neutral-700">
            Perfil não encontrado
          </Text>
          <Text className="text-center font-sans text-sm text-neutral-500">
            Essa conta pode ter sido removida.
          </Text>
        </View>
      ) : (
        <FlatList
          data={data.posts}
          keyExtractor={(post: Post) => post.id}
          contentContainerClassName="gap-4 px-4 pb-8"
          ListHeaderComponent={cabecalho}
          ListEmptyComponent={
            data.is_following || data.is_me ? (
              <View className="items-center px-6 py-10">
                <Text className="text-center font-sans text-sm text-neutral-500">
                  {data.is_me
                    ? "Você ainda não publicou nada."
                    : `${nome} ainda não publicou nada.`}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}
    </SafeAreaView>
  );
}
