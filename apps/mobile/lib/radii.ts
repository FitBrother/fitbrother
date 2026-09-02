/**
 * JS mirror dos raios de borda do `tailwind.config.ts`.
 * Mesmo papel do `lib/colors.ts`: usar a partir de SVG, Skia ou Reanimated,
 * onde a API de className do NativeWind não vale. Manter em sincronia com o
 * config — divergência é bug, e há teste que checa isso.
 */

export const radii = {
  input: 12, // rounded-xl
  card: 26, // rounded-[26px] — a curva dos pills de 52pt (rounded-full ÷ 2)
  banner: 12, // rounded-xl
  full: 9999, // rounded-full
} as const;
