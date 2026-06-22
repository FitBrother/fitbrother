import { Platform } from "react-native";

/**
 * Shared soft-shadow presets. Use via `style={shadows.card}` on Views/Pressables.
 * iOS uses native shadow* props; Android uses elevation. CLAUDE.md §UI rule 6.
 */
export const shadows = {
  // Subtle elevation for resting cards. Large radius, low opacity → soft.
  card: Platform.select({
    ios: {
      shadowColor: "#04100C",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
    },
    android: { elevation: 2 },
    default: {},
  }),
  // Slightly deeper for floating UI (composer pill, button) that hovers above
  // the content layer.
  floating: Platform.select({
    ios: {
      shadowColor: "#04100C",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    android: { elevation: 6 },
    default: {},
  }),
} as const;
