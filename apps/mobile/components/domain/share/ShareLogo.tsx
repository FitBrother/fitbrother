import { Image } from "react-native";
import { Logo } from "@/components/Logo";

import logoSombra from "@/assets/brand/logo-horizontal-branco-sombra.png";

export type ShareLogoVariant = "white" | "menta" | "sombra";

/** Proporção do PNG com sombra (1230 × 239 px), margem incluída. */
export const LOGO_SOMBRA_ASPECT = 1230 / 239;

/** Quanto a margem da sombra representa da altura do lockup (24 de 191 px). */
export const LOGO_SOMBRA_MARGEM = 24 / 191;

/**
 * O lockup da marca dentro do card compartilhável.
 *
 * No nativo é o `<Logo>` de sempre — o `captureRef` desenha a árvore de views
 * de verdade e não tem o problema que a web tem. A versão web está em
 * `ShareLogo.web.tsx`, e o comentário do porquê mora lá.
 *
 * `sombra` é o logo do story: fica sobre qualquer foto, com a vinheta desligada,
 * então o contraste precisa vir dele. A sombra é assada no PNG (ver
 * `scripts/gerar-logo-sombra.mjs`). A margem negativa mantém a caixa do tamanho
 * do lockup, para a sombra não contar no toque nem no limite do quadro.
 */
export function ShareLogo({ height, variant }: { height: number; variant: ShareLogoVariant }) {
  if (variant !== "sombra") return <Logo height={height} variant={variant} />;
  const altura = height * (1 + 2 * LOGO_SOMBRA_MARGEM);
  return (
    <Image
      source={logoSombra}
      accessibilityLabel="Fitbrother"
      resizeMode="contain"
      style={{
        height: altura,
        width: altura * LOGO_SOMBRA_ASPECT,
        margin: -height * LOGO_SOMBRA_MARGEM,
      }}
    />
  );
}
