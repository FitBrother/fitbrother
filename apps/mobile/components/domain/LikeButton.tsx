import { Heart } from "lucide-react-native";
import { Pressable, Text } from "react-native";
import { colors } from "@/lib/colors";
import { useToggleLike } from "@/lib/hooks/useToggleLike";

const NUM: { fontVariant: ["tabular-nums"] } = { fontVariant: ["tabular-nums"] };

export function LikeButton({
  postId,
  liked,
  count,
}: {
  postId: string;
  liked: boolean;
  count: number;
}) {
  const toggle = useToggleLike();
  return (
    <Pressable
      onPress={() => toggle.mutate({ postId, liked: !liked })}
      accessibilityRole="button"
      accessibilityLabel={liked ? "Descurtir post" : "Curtir post"}
      className="min-h-[44px] min-w-[44px] flex-row items-center gap-1.5"
    >
      <Heart
        size={20}
        color={liked ? colors.danger[500] : colors.neutral[500]}
        fill={liked ? colors.danger[500] : "transparent"}
      />
      <Text style={NUM} className="font-sans-medium text-neutral-600">
        {count}
      </Text>
    </Pressable>
  );
}
