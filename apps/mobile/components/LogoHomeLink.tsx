import { Platform, Pressable } from "react-native";

import { Logo } from "@/components/Logo";
import { landingUrl } from "@/lib/site";

interface LogoHomeLinkProps {
  height: number;
  className?: string;
}

/**
 * Logo que leva de volta para a landing page.
 *
 * Só é interativo na web: no app nativo não existe "voltar para o site", então
 * lá ele degrada para imagem pura em vez de anunciar um papel de link que não
 * leva a lugar nenhum.
 *
 * Usa `window.location.assign` em vez de `Linking.openURL` porque a intenção é
 * sair do app para o site — abrir numa aba nova deixaria o app órfão atrás.
 */
export function LogoHomeLink({ height, className }: LogoHomeLinkProps) {
  if (Platform.OS !== "web") {
    return <Logo height={height} className={className} />;
  }

  return (
    <Pressable
      onPress={() => window.location.assign(landingUrl)}
      accessibilityRole="link"
      accessibilityLabel="Fitbrother — ir para a página inicial"
      // O lockup tem 28-40pt de altura; o hit target mínimo vem do min-h.
      className={`min-h-[44px] justify-center self-start ${className ?? ""}`}
    >
      <Logo height={height} />
    </Pressable>
  );
}
