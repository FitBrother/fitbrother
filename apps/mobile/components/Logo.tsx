import { Image } from "react-native";

import logoMenta from "@/assets/brand/logo-horizontal-menta.png";
import logoWhite from "@/assets/brand/logo-horizontal-branco.png";

// ─── Types ────────────────────────────────────────────────────────────────────

type LogoVariant = "menta" | "white";

interface LogoProps {
  /** Altura em pt. A largura é derivada — o lockup nunca deforma. */
  height: number;
  variant?: LogoVariant;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Proporção do lockup horizontal (1182 × 191 px). */
const ASPECT_RATIO = 1182 / 191;

const SOURCES: Record<LogoVariant, number> = {
  menta: logoMenta,
  // Derivada do menta com o RGB pintado de branco e o alpha preservado, para
  // superfícies onde o verde da marca não teria contraste (ex.: o gradiente do
  // ShareCard).
  white: logoWhite,
};

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Lockup horizontal da marca. Recebe só a altura porque a largura sai da
 * proporção — foi assim que os tamanhos fixos espalhados pelas telas viraram
 * um número só.
 *
 * É puramente apresentacional: quem precisa de logo clicável envolve num
 * `Pressable` (ver `app/(auth)/welcome.tsx`).
 */
export function Logo({ height, variant = "menta", className }: LogoProps) {
  return (
    <Image
      source={SOURCES[variant]}
      style={{ height, width: height * ASPECT_RATIO }}
      resizeMode="contain"
      accessibilityLabel="Fitbrother"
      className={className}
    />
  );
}
