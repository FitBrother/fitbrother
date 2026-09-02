import type { Post } from "@fitbrother/shared";
import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { MessageCircle, Share2 } from "lucide-react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { getPostImageSignedUrl } from "@/lib/storage";
import { LikeButton } from "./LikeButton";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

function timeLabel(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const name = post.author.display_name ?? "Fitbrother";
  const username = post.author.username ? `@${post.author.username}` : "";
  const achievement = post.post_type === "achievement" ? post.achievement : null;
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (post.image_path) {
      getPostImageSignedUrl(post.image_path)
        .then((url) => {
          if (active) setImageUrl(url);
        })
        .catch(() => {
          if (active) setImageUrl(null);
        });
    }
    return () => {
      active = false;
    };
  }, [post.image_path]);

  return (
    <View style={shadows.card} className="rounded-[26px] bg-white p-4">
      <View className="flex-row items-center">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-50">
          <Text className="font-sans-bold text-primary-700">{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-sans-semibold text-neutral-800">{name}</Text>
          <Text className="font-sans text-xs text-neutral-500">
            {username} · {timeLabel(post.created_at)}
          </Text>
        </View>
      </View>

      {post.caption ? (
        <Text className="mt-3 text-base font-sans text-neutral-800">{post.caption}</Text>
      ) : null}

      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          accessibilityIgnoresInvertColors
          className="mt-3 h-64 w-full rounded-2xl"
          resizeMode="cover"
        />
      ) : null}

      {achievement ? (
        <View className="mt-4 rounded-2xl border border-warning-400 bg-warning-50 p-4">
          <Text className="text-xs font-sans-semibold uppercase text-warning-500">Conquista</Text>
          <Text className="mt-2 text-xl font-display-bold text-neutral-800">
            {achievement.title}
          </Text>
          <Text className="mt-1 text-sm font-sans text-neutral-600">{achievement.description}</Text>
        </View>
      ) : (
        <View className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <Text style={NUM} className="text-2xl font-display-bold text-neutral-800">
            {Math.round(post.total_kcal)} kcal
          </Text>
          <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
            {Math.round(post.total_protein_g)}g P · {Math.round(post.total_carbs_g)}g C ·{" "}
            {Math.round(post.total_fat_g)}g G
          </Text>
        </View>
      )}

      <View className="mt-3 flex-row items-center gap-4 border-t border-neutral-100 pt-2">
        <LikeButton postId={post.id} liked={post.liked_by_me} count={post.like_count} />
        <Pressable
          onPress={() => router.push(`/(app)/post/${post.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel="Ver comentários"
          className="min-h-[44px] min-w-[44px] flex-row items-center gap-1.5"
        >
          <MessageCircle size={20} color={colors.neutral[500]} />
          <Text style={NUM} className="font-sans-medium text-neutral-600">
            {post.comment_count}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/(app)/share/post/${post.id}` as never)}
          accessibilityRole="button"
          accessibilityLabel="Exportar imagem"
          className="ml-auto min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <Share2 size={20} color={colors.neutral[500]} />
        </Pressable>
      </View>
    </View>
  );
}
