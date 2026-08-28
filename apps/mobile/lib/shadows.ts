import { Platform } from "react-native";

/**
 * Shared soft-shadow preset. Use via `style={shadows.card}` on Views/Pressables.
 * iOS uses native shadow props; Android uses elevation; web uses boxShadow —
 * react-native-web ignores the iOS/Android props, so this needs its own case
 * (Platform.select falls through to `default` on web otherwise). CLAUDE.md §UI rule 6.
 */
const elevated = Platform.select({
  ios: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  web: { boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)" },
  default: {},
});

export const shadows = {
  card: elevated,
  // Same recipe as `card` — kept as a separate key so call sites can
  // describe intent (floating composer UI vs. resting cards) even though
  // the visual weight is now unified across the app.
  floating: elevated,
} as const;
