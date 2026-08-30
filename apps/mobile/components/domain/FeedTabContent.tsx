import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FeedPostsPanel } from "@/components/domain/FeedPostsPanel";
import { FriendsPanel } from "@/components/domain/FriendsPanel";

type FeedSubTab = "posts" | "friends";

/**
 * Aba "Feed" da Home no mobile — Amigos deixou de ser destino de navegação
 * principal e virou sub-aba aqui dentro, ao lado de Publicações.
 */
export function FeedTabContent() {
  const [subTab, setSubTab] = useState<FeedSubTab>("posts");

  return (
    <View className="flex-1">
      <View className="mx-4 mb-2 mt-2 flex-row rounded-full bg-neutral-100 p-1">
        <Pressable
          onPress={() => setSubTab("posts")}
          accessibilityRole="button"
          accessibilityLabel="Publicações"
          accessibilityState={{ selected: subTab === "posts" }}
          className={`min-h-[44px] flex-1 items-center justify-center rounded-full ${subTab === "posts" ? "bg-white" : ""}`}
        >
          <Text
            className={
              subTab === "posts"
                ? "font-sans-semibold text-neutral-800"
                : "font-sans text-neutral-500"
            }
          >
            Publicações
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSubTab("friends")}
          accessibilityRole="button"
          accessibilityLabel="Amigos"
          accessibilityState={{ selected: subTab === "friends" }}
          className={`min-h-[44px] flex-1 items-center justify-center rounded-full ${subTab === "friends" ? "bg-white" : ""}`}
        >
          <Text
            className={
              subTab === "friends"
                ? "font-sans-semibold text-neutral-800"
                : "font-sans text-neutral-500"
            }
          >
            Amigos
          </Text>
        </Pressable>
      </View>
      {subTab === "posts" ? <FeedPostsPanel /> : <FriendsPanel />}
    </View>
  );
}
