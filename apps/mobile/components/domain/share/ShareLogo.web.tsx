import logoMenta from "@/assets/brand/logo-horizontal-menta.png";
import logoBranco from "@/assets/brand/logo-horizontal-branco.png";
import type { ShareLogoVariant } from "./ShareLogo";

/** Proporção do lockup horizontal (1182 × 191 px), a mesma de `Logo.tsx`. */
const ASPECT_RATIO = 1182 / 191;

// No nativo um asset importado é um número que só `resolveAssetSource`
// traduz; na web o Metro já entrega a URL (às vezes crua, às vezes embrulhada
// num objeto com `uri`). Como este arquivo só roda na web, basta desembrulhar
// — `Image.resolveAssetSource` nem existe no react-native-web.
type AssetWeb = string | { uri: string };

const FONTES: Record<ShareLogoVariant, AssetWeb> = {
  menta: logoMenta as unknown as AssetWeb,
  white: logoBranco as unknown as AssetWeb,
};

function urlDo(asset: AssetWeb): string {
  return typeof asset === "string" ? asset : asset.uri;
}

/**
 * O lockup da marca no card, desenhado com uma `<img>` de verdade.
 *
 * **Esta é a única `<img>` do app, e ela existe por um motivo medido.** O
 * `react-native-web` renderiza toda `Image` como uma `<div>` com
 * `background-image`. Para desenhar background, o html2canvas monta um pattern
 * num canvas do tamanho CSS do elemento e só depois aplica o scale da
 * exportação — então um lockup de 18px de altura era rasterizado a 18px e
 * ampliado 3×, saindo como uma mancha branca borrada. Medido no próprio
 * navegador, reproduzindo os dois caminhos sobre o mesmo PNG de 1182×191:
 * via pattern, 27% dos pixels ficam em meio-tom; via `drawImage` de uma `<img>`,
 * 5,2%. Aumentar o lockup não resolvia — o fator de ampliação é o mesmo.
 *
 * Com uma `<img>`, o html2canvas chama `drawImage` com a fonte em resolução
 * plena direto no contexto já escalado, e o logo sai nítido no PNG de
 * 1080×1920.
 *
 * O `<Logo>` do resto do app continua como está: fora da exportação, a `<div>`
 * com background renderiza igual e o problema não existe.
 */
export function ShareLogo({ height, variant }: { height: number; variant: ShareLogoVariant }) {
  const src = urlDo(FONTES[variant]);
  return (
    <img
      src={src}
      alt="Fitbrother"
      style={{ height, width: height * ASPECT_RATIO, display: "block" }}
    />
  );
}
