import type { Post } from "@fitbrother/shared";
import { Text, View } from "react-native";
import { shadows } from "@/lib/shadows";

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
  const name = post.author.display_name ?? "Fitbrother";
  const username = post.author.username ? `@${post.author.username}` : "";
  const achievement = post.post_type === "achievement" ? post.achievement : null;

  return (
    <View style={shadows.card} className="rounded-2xl bg-white p-4">
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

      {achievement ? (
        <View className="mt-4 rounded-2xl border border-warning-400 bg-warning-50 p-4">
          <Text className="text-xs font-sans-semibold uppercase text-warning-500">Conquista</Text>
          <Text className="mt-2 text-xl font-sans-extrabold text-neutral-800">
            {achievement.title}
          </Text>
          <Text className="mt-1 text-sm font-sans text-neutral-600">{achievement.description}</Text>
        </View>
      ) : (
        <View className="mt-4 rounded-2xl bg-neutral-50 p-4">
          <Text style={NUM} className="text-2xl font-sans-extrabold text-neutral-800">
            {Math.round(post.total_kcal)} kcal
          </Text>
          <Text style={NUM} className="mt-1 text-sm font-sans text-neutral-500">
            {Math.round(post.total_protein_g)}g P · {Math.round(post.total_carbs_g)}g C ·{" "}
            {Math.round(post.total_fat_g)}g G
          </Text>
        </View>
      )}
    </View>
  );
}
