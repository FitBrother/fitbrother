/**
 * JS mirror of the Tailwind tokens in `tailwind.config.ts`.
 * Use these from SVG (`react-native-svg`), Skia or Reanimated where the
 * NativeWind className API isn't available. Keep in sync with the Tailwind
 * config — any divergence is a bug.
 */

export const colors = {
  primary: {
    50: "#F0FDFC",
    100: "#CCFBF1",
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#14B8A6",
    600: "#0D9488",
    700: "#0F766E",
    800: "#115E59",
    900: "#134E4A",
  },
  // Alias semântico pro hero ring de calorias. Brand teal é o token de
  // calorias no domínio nutricional (DESIGN_SYSTEM §12.1).
  calories: { 50: "#F0FDFC", 100: "#CCFBF1", 500: "#14B8A6", 600: "#0D9488" },
  neutral: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },
  danger: {
    50: "#FEF2F2",
    500: "#EF4444",
    600: "#DC2626",
  },
  success: {
    50: "#F0FDF4",
    500: "#22C55E",
    600: "#16A34A",
  },
  warning: {
    50: "#FFFBEB",
    400: "#FBBF24",
    500: "#F59E0B",
  },
  protein: { 50: "#FFF1F2", 100: "#FFE4E6", 500: "#F43F5E", 600: "#E11D48" },
  carbs: { 50: "#FFFBEB", 100: "#FEF3C7", 500: "#F59E0B", 600: "#D97706" },
  fat: { 50: "#F5F3FF", 100: "#EDE9FE", 500: "#8B5CF6", 600: "#7C3AED" },
  streak: { 50: "#FFF7ED", 100: "#FFEDD5", 400: "#FB923C", 500: "#F97316", 600: "#EA580C" },
} as const;
