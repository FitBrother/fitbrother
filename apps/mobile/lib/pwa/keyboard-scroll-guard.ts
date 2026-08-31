import { Platform } from "react-native";

/**
 * Decide se vale ancorar o documento no topo.
 *
 * Só faz sentido enquanto o teclado está fechado: com ele aberto o navegador
 * desloca a viewport de propósito, para o input não ficar embaixo do teclado,
 * e desfazer isso brigaria com o comportamento certo. A heurística de "aberto"
 * é a visual viewport estar sensivelmente mais baixa que a layout viewport.
 */
export function shouldPinToTop(params: {
  scrollY: number;
  visualHeight: number;
  layoutHeight: number;
}): boolean {
  const TOLERANCIA_PX = 80;
  const tecladoAberto = params.layoutHeight - params.visualHeight > TOLERANCIA_PX;
  return params.scrollY !== 0 && !tecladoAberto;
}

/**
 * Impede que o documento fique preso rolado no web.
 *
 * O app inteiro rola dentro de ScrollViews; o documento em si nunca deveria
 * rolar. Mas o `overflow: hidden` do body só barra o scroll do usuário, não o
 * programático — o navegador rola sozinho para revelar o input ao abrir o
 * teclado, e no iOS nem sempre volta ao fechá-lo. O resultado é o topo da tela
 * (ofensivas e foto de perfil) cortado sem forma de recuperar.
 *
 * A causa principal — a margem de 8px do body, que dava o que rolar — foi
 * removida em `public/index.html`. Isto aqui é a rede de proteção para o iOS,
 * que também desloca a viewport por conta própria.
 *
 * Devolve a função de cleanup. No-op fora do web.
 */
export function installKeyboardScrollGuard(): () => void {
  if (Platform.OS !== "web" || typeof window === "undefined") return () => {};

  const anchor = () => {
    if (
      shouldPinToTop({
        scrollY: window.scrollY,
        visualHeight: window.visualViewport?.height ?? window.innerHeight,
        layoutHeight: window.innerHeight,
      })
    ) {
      window.scrollTo(0, 0);
    }
  };

  // `focusout` cobre o fechamento do teclado por blur do input; o resize da
  // visual viewport cobre o fechamento pelo botão do próprio teclado, que não
  // necessariamente tira o foco do campo.
  window.addEventListener("focusout", anchor);
  window.visualViewport?.addEventListener("resize", anchor);

  return () => {
    window.removeEventListener("focusout", anchor);
    window.visualViewport?.removeEventListener("resize", anchor);
  };
}
