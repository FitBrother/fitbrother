import { ActivityIndicator, View } from "react-native";
import { colors } from "@/lib/colors";

/**
 * Placeholder index for the (app) group.
 * Will be replaced by the Dashboard screen in a later task.
 */
export default function AppIndex() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={colors.primary[400]} />
    </View>
  );
}
