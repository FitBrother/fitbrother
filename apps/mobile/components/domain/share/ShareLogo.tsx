import { Logo } from "@/components/Logo";

export type ShareLogoVariant = "white" | "menta";

/**
 * O lockup da marca dentro do card compartilhável.
 *
 * No nativo é o `<Logo>` de sempre — o `captureRef` desenha a árvore de views
 * de verdade e não tem o problema que a web tem. A versão web está em
 * `ShareLogo.web.tsx`, e o comentário do porquê mora lá.
 */
export function ShareLogo({ height, variant }: { height: number; variant: ShareLogoVariant }) {
  return <Logo height={height} variant={variant} />;
}
