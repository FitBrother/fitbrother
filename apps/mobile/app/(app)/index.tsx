import { ActivityIndicator, View } from "react-native";

/**
 * Placeholder index for the (app) group.
 * Will be replaced by the Dashboard screen in a later task.
 */
export default function AppIndex() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#2DD4BF" />
    </View>
  );
}
