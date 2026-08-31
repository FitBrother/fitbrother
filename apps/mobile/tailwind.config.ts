import type { Config } from "tailwindcss";

// nativewind/preset ships an empty .d.ts so its `import` form fails the
// "not a module" check. `require` is the loader Tailwind uses anyway when
// resolving the preset, so we keep it — but mute the lint rule, narrowly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nativewindPreset = require("nativewind/preset");

const config: Config = {
  // NativeWind controls the React Native color scheme at runtime. Its web
  // observer cannot do that while Tailwind uses the default `media` strategy.
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      // ─── Colors ──────────────────────────────────────────────────────────────
      colors: {
        // Brand — Menta (mint) — CTAs, ícones, anel de calorias, marca-texto.
        // Mesmos nomes de token (primary-*); só os valores migraram de teal
        // para menta (DESIGN_SYSTEM §2.1). primary-400 = #06D59F é a principal.
        primary: {
          50: "#E9FCF5",
          100: "#C6F7E6",
          200: "#8FEFCD",
          300: "#4BE5AE",
          400: "#06D59F", // ← COR PRINCIPAL (menta)
          500: "#05B789", // pressed / hover
          600: "#04A87E", // menta de texto/realce sobre claro (passa AA)
          700: "#038266",
          800: "#02624D",
          900: "#014537",
        },

        // Marca — Tinta (ink) & superfícies claras (3 camadas).
        ink: "#04100C", // texto principal, réguas, botão dark, contraste máximo
        "ink-soft": "#0A1F17", // variante levemente mais clara
        canvas: "#F6F7F5", // fundo de tela (off-white)
        surface: "#FFFFFF", // cards
        mist: "#ECEEEE", // seções/fills alternados

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
          900: "#04100C", // tinta (ink) — botão dark, texto máximo contraste
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
        // Macros — tons da landing, ajustados p/ contraste sobre claro (§0).
        protein: {
          50: "#FFF1F2",
          100: "#FFE4E6",
          500: "#E8506B",
          600: "#D13355",
        },
        carbs: {
          50: "#FFFBEB",
          100: "#FEF3C7",
          500: "#D98A1C",
          600: "#B86F12",
        },
        fat: {
          50: "#F5F3FF",
          100: "#EDE9FE",
          500: "#7A5BE0",
          600: "#6442C9",
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
        // Duas famílias da marca (DESIGN_SYSTEM §3):
        //   • Inter         → corpo: parágrafos, labels, inputs, metadados.
        //   • Space Grotesk → display: headings, títulos de card, números hero.
        //
        // ⚠️ ATENÇÃO React Native: usar SEMPRE estas famílias por peso.
        // Os utilitários nativos `font-medium`/`font-semibold`/`font-bold`
        // aplicam apenas `fontWeight` e NÃO trocam a fontFamily — o resultado é
        // a Regular sintetizada artificialmente. Use:
        //   Corpo (Inter):    font-sans / -medium / -semibold / -bold / -extrabold
        //   Display (Space Grotesk): font-display / -medium / -semibold / -bold
        // Space Grotesk vai só até 700 — display "extrabold" usa font-display-bold.
        sans: ["Inter_400Regular", "System"],
        "sans-medium": ["Inter_500Medium", "System"],
        "sans-semibold": ["Inter_600SemiBold", "System"],
        "sans-bold": ["Inter_700Bold", "System"],
        "sans-extrabold": ["Inter_800ExtraBold", "System"],
        display: ["SpaceGrotesk_500Medium", "System"],
        "display-medium": ["SpaceGrotesk_500Medium", "System"],
        "display-semibold": ["SpaceGrotesk_600SemiBold", "System"],
        "display-bold": ["SpaceGrotesk_700Bold", "System"],
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
        "input-height": "52px", // altura dos inputs
        "button-height": "52px", // altura dos botões md
        "button-height-sm": "44px", // = alvo de toque mínimo e altura da barra de abas
        "button-height-lg": "60px",
      },

      // ─── Border Radius ───────────────────────────────────────────────────────
      borderRadius: {
        // Já existem no Tailwind: rounded-xl (12px), rounded-full
        // Tokens semânticos para manter consistência:
        input: "12px", // → use rounded-xl
        card: "22px", // → use rounded-[22px]: a curva dos pills de 44pt (full ÷ 2)
        button: "9999px", // → use rounded-full
        badge: "9999px", // → use rounded-full
        banner: "12px", // → use rounded-xl
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
