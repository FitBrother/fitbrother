import { useState } from "react";
import { View } from "react-native";
import { FeedPostsPanel } from "@/components/domain/FeedPostsPanel";
import { FriendsPanel } from "@/components/domain/FriendsPanel";
import { SubTabs } from "@/components/domain/SubTabs";

type FeedSubTab = "posts" | "friends";

const SUB_TABS = [
  { key: "posts", label: "Feed" },
  { key: "friends", label: "Amigos" },
] as const satisfies readonly { key: FeedSubTab; label: string }[];

/**
 * Aba "Social" da Home no mobile — Amigos deixou de ser destino de navegação
 * principal e virou sub-aba aqui dentro, ao lado do Feed.
 */
export function FeedTabContent() {
  const [subTab, setSubTab] = useState<FeedSubTab>("posts");

  return (
    <View className="flex-1">
      <SubTabs tabs={SUB_TABS} active={subTab} onChange={setSubTab} />
      {subTab === "posts" ? <FeedPostsPanel /> : <FriendsPanel />}
    </View>
  );
}
