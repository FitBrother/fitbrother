import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

// A captura mora em `share/capture`, que o Metro resolve por plataforma
// (`capture.web.ts` na web, `capture.ts` no nativo). São implementações
// diferentes de verdade, não só opções diferentes — ver o comentário na web.
import { blobCapturado, captureCard } from "./share/capture";

export { captureCard };

/**
 * Maior lado que a foto precisa ter para entrar no card.
 *
 * O quadro exportado é 1080×1920, e a foto é desenhada com `cover` dentro
 * dele — acima disso não há pixel que chegue à imagem final. Foto de celular
 * chega com 3024×4032 (12 MP): guardar isso é pagar decodificação e memória
 * de doze vezes o que se vê.
 */
const MAIOR_LADO = 1920;

/**
 * Prepara a foto para o card: reduz ao que cabe no quadro e devolve um blob URL.
 *
 * **Por que data URI.** Na web a captura usa html2canvas, que "tainta" o
 * canvas ao desenhar uma `<img>` cross-origin (a URL assinada do Supabase
 * Storage é) — depois disso `toDataURL()` lança SecurityError. Buscar por
 * fetch e converter resolve o cross-origin antes de a imagem chegar no
 * `<Image>`.
 *
 * **Por que reduzir.** A foto original era embutida inteira, e o html2canvas
 * redesenhava esses 12 MP a cada captura. Medido com CPU estrangulada em 6×
 * (celular lento), folheando três presets: 18 travadas de thread principal,
 * a maior de 698ms. O redimensionamento acontece UMA vez, aqui, e vale para
 * todos os presets e para a exportação.
 *
 * A fonte do `drawImage` é um blob URL (mesma origem), então o canvas não
 * tainta e dá para exportar o resultado.
 */
export async function toDisplayableImageUri(url: string): Promise<string> {
  if (Platform.OS !== "web") return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image_fetch_failed_${res.status}`);
  const blob = await res.blob();

  const blobUrl = URL.createObjectURL(blob);
  try {
    const img = await carregarImagem(blobUrl);
    const escala = Math.min(1, MAIOR_LADO / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_context_unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Blob URL, e não data URI: o react-native-web põe a fonte da imagem no
    // atributo `style` do elemento, e o carrossel desenha o mesmo card em
    // vários presets. Em data URI isso são dezenas de KB de string repetidos
    // em cada um, que o motor de estilo reanalisa a cada render. Um blob URL
    // tem algumas dezenas de caracteres. Continua sendo mesma origem, então
    // não tainta o canvas do html2canvas — que é o motivo de tudo isso.
    //
    // Quem criou revoga: ver `useEffect` de limpeza em `share/[type]/[id]`.
    return await new Promise<string>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error("canvas_to_blob_failed"))),
        "image/jpeg",
        0.9,
      );
    });
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_decode_failed"));
    img.src = src;
  });
}

const NOME_ARQUIVO = "fitbrother-card.png";

/**
 * Monta o `File` do card SEM await.
 *
 * A captura na web devolve um blob URL e guarda o Blob; pegá-lo daqui evita
 * ter que buscar os bytes de volta pelo uri, o que introduziria um await bem
 * dentro da janela de ativação do clique que o `navigator.share()` exige.
 */
function arquivoDoCard(uri: string): File | null {
  const blob = blobCapturado(uri);
  return blob ? new File([blob], NOME_ARQUIVO, { type: blob.type || "image/png" }) : null;
}

/** Baixa o uri como arquivo via um <a download> temporário. */
function baixarUri(uri: string, filename: string): void {
  const link = document.createElement("a");
  link.href = uri;
  link.download = filename;
  link.click();
}

/**
 * Abre o share sheet nativo com a imagem (Web Share API na web).
 *
 * Na web cai para o download em dois casos: quando o navegador não sabe
 * compartilhar arquivo (desktop, em geral), e quando ele recusa o
 * `navigator.share()` por ativação — a imagem é gerada DEPOIS do toque, e a
 * geração pode passar da janela que o navegador considera "resposta ao
 * gesto". Baixar entrega a mesma imagem; ficar sem nada, não.
 */
export async function shareCard(uri: string): Promise<void> {
  if (Platform.OS === "web") {
    const file = arquivoDoCard(uri);
    if (file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Fitbrother" });
        return;
      } catch (err) {
        // AbortError é desistência da pessoa — sobe, para o chamador ficar
        // quieto. NotAllowedError é a janela de ativação perdida.
        if (err instanceof Error && err.name === "AbortError") throw err;
        if (!(err instanceof Error) || err.name !== "NotAllowedError") throw err;
      }
    }
    baixarUri(uri, NOME_ARQUIVO);
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("sharing_unavailable");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Compartilhar",
    UTI: "public.png",
  });
}

/** Salva na galeria (pede permissão). Lança 'gallery_permission_denied' se negada. */
export async function saveCardToGallery(uri: string): Promise<void> {
  if (Platform.OS === "web") {
    baixarUri(uri, NOME_ARQUIVO);
    return;
  }

  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error("gallery_permission_denied");
  await MediaLibrary.saveToLibraryAsync(uri);
}
