/**
 * JS mirror of the Tailwind tokens in `tailwind.config.ts`.
 * Use these from SVG (`react-native-svg`), Skia or Reanimated where the
 * NativeWind className API isn't available. Keep in sync with the Tailwind
 * config — any divergence is a bug.
 */

export const colors = {
  // Marca — Menta (mint). Migrado de teal (DESIGN_SYSTEM §2.1).
  primary: {
    50: "#E9FCF5",
    100: "#C6F7E6",
    200: "#8FEFCD",
    300: "#4BE5AE",
    400: "#06D59F",
    500: "#05B789",
    600: "#04A87E",
    700: "#038266",
    800: "#02624D",
    900: "#014537",
  },
  // Alias semântico pro hero ring de calorias. A menta é o token de
  // calorias no domínio nutricional (DESIGN_SYSTEM §12.1).
  calories: { 50: "#E9FCF5", 100: "#C6F7E6", 500: "#06D59F", 600: "#04A87E" },
  // Tinta (ink) — texto principal, botão dark, contraste máximo.
  ink: "#04100C",
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
    900: "#04100C", // tinta (ink) — alinhado ao token neutral-900 do Tailwind
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
  protein: { 50: "#FFF1F2", 100: "#FFE4E6", 500: "#E8506B", 600: "#D13355" },
  carbs: { 50: "#FFFBEB", 100: "#FEF3C7", 500: "#D98A1C", 600: "#B86F12" },
  fat: { 50: "#F5F3FF", 100: "#EDE9FE", 500: "#7A5BE0", 600: "#6442C9" },
  streak: { 50: "#FFF7ED", 100: "#FFEDD5", 400: "#FB923C", 500: "#F97316", 600: "#EA580C" },
} as const;
