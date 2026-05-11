import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // ─── Colors ──────────────────────────────────────────────────────────────
      colors: {
        // Brand — Teal (cor extraída do Splash, botões CTA, ícones)
        primary: {
          50: "#F0FDFC",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF", // ← COR PRINCIPAL
          500: "#14B8A6", // pressed / hover
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },

        // Neutrals — usados em textos, fundos, bordas
        neutral: {
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B", // headings principais
          900: "#0F172A", // botão Google, texto máximo contraste
        },

        // Feedback — Erro
        danger: {
          50: "#FEF2F2",
          100: "#FEE2E2",
          200: "#FECACA",
          300: "#FCA5A5",
          400: "#F87171",
          500: "#EF4444", // texto/ícone de erro
          600: "#DC2626", // borda do banner de erro
          700: "#B91C1C",
          800: "#991B1B",
          900: "#7F1D1D",
        },

        // Feedback — Sucesso
        success: {
          50: "#F0FDF4",
          100: "#DCFCE7",
          200: "#BBF7D0",
          300: "#86EFAC",
          400: "#4ADE80",
          500: "#22C55E", // checkmarks, senha forte, "Taken", "Free Delivery"
          600: "#16A34A",
          700: "#15803D",
          800: "#166534",
          900: "#14532D",
        },

        // Feedback — Alerta
        warning: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          200: "#FDE68A",
          300: "#FCD34D",
          400: "#FBBF24", // estrelas, badge "50% OFF"
          500: "#F59E0B", // senha média
          600: "#D97706",
          700: "#B45309",
          800: "#92400E",
          900: "#78350F",
        },

        // ─── Domínio Nutricional ──────────────────────────────────────────────
        // Macros — anéis de progresso, badges e barras
        // Calorias usam primary-400 (cor da marca, anel central do dashboard).
        protein: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          500: "#F43F5E",
          600: "#E11D48",
        },
        carbs: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#F59E0B",
          600: "#D97706",
        },
        fat: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          500: "#8B5CF6",
          600: "#7C3AED",
        },

        // Streak (🔥) — gamificação
        streak: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
        },
      },

      // ─── Typography ──────────────────────────────────────────────────────────
      fontFamily: {
        // Instalar: npx expo install @expo-google-fonts/plus-jakarta-sans expo-font
        //
        // ⚠️ ATENÇÃO React Native: usar SEMPRE estas famílias por peso.
        // Os utilitários nativos `font-medium`/`font-semibold`/`font-bold`
        // aplicam apenas `fontWeight` e NÃO trocam a fontFamily — o resultado é
        // a Plus Jakarta Regular sintetizada artificialmente. Use:
        //   font-sans            (400)
        //   font-sans-medium     (500)
        //   font-sans-semibold   (600)
        //   font-sans-bold       (700)
        //   font-sans-extrabold  (800)
        sans: ["PlusJakartaSans_400Regular", "System"],
        "sans-medium": ["PlusJakartaSans_500Medium", "System"],
        "sans-semibold": ["PlusJakartaSans_600SemiBold", "System"],
        "sans-bold": ["PlusJakartaSans_700Bold", "System"],
        "sans-extrabold": ["PlusJakartaSans_800ExtraBold", "System"],
      },

      fontSize: {
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["14px", { lineHeight: "20px" }],
        base: ["16px", { lineHeight: "24px" }],
        lg: ["18px", { lineHeight: "28px" }],
        xl: ["20px", { lineHeight: "28px" }],
        "2xl": ["24px", { lineHeight: "32px" }],
        "3xl": ["28px", { lineHeight: "36px" }],
        "4xl": ["32px", { lineHeight: "40px" }],
        "5xl": ["40px", { lineHeight: "48px" }],
      },

      // ─── Spacing (base 4px — alinhado ao grid do Tailwind padrão) ────────────
      // O Tailwind já usa base 4px por padrão. As extensões abaixo adicionam
      // tokens semânticos específicos do app.
      spacing: {
        "safe-horizontal": "20px", // padding horizontal das telas
        "input-height": "52px",    // altura dos inputs
        "button-height": "52px",   // altura dos botões md
        "button-height-sm": "40px",
        "button-height-lg": "60px",
      },

      // ─── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        // Já existem no Tailwind: rounded-xl (12px), rounded-2xl (16px), rounded-full
        // Tokens semânticos para manter consistência:
        input: "12px",   // → use rounded-xl
        card: "16px",    // → use rounded-2xl
        button: "9999px", // → use rounded-full
        badge: "9999px", // → use rounded-full
        banner: "12px",  // → use rounded-xl
      },

      // ─── Box Shadows (iOS) ───────────────────────────────────────────────────
      // NativeWind v4 aplica shadow-* como shadowColor/shadowOffset/etc. no iOS.
      // Para Android, use elevation via style prop diretamente.
      boxShadow: {
        card: "0 1px 4px rgba(0, 0, 0, 0.06)",
        "card-md": "0 4px 12px rgba(0, 0, 0, 0.10)",
        none: "none",
      },
    },
  },
  plugins: [],
};

export default config;
