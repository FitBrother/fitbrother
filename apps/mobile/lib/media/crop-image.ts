import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { retanguloDeCorte, type Enquadramento, type Tamanho } from "./crop";

/**
 * Largura em que a foto do feed é gravada.
 *
 * O card ocupa a largura da tela; num celular de 430pt com tela 3× isso dá
 * ~1290px no pior caso, e 1080 é o degrau padrão logo abaixo — a diferença não
 * se vê e o arquivo cai pela metade. Quem carrega esse peso é quem rola o
 * feed, não quem posta.
 */
export const LARGURA_FOTO_FEED = 1080;

/**
 * Grava o enquadramento na imagem: devolve o uri de uma foto já recortada.
 *
 * O recorte deixa de ser um ajuste de exibição e passa a ser a imagem. É o que
 * permite o feed não ter campo novo no banco nem baixar a foto inteira em todo
 * card — e também o que torna o recorte definitivo, só refazível repostando.
 *
 * O quadro passado para `retanguloDeCorte` é arbitrário: o que importa dele é a
 * PROPORÇÃO, porque o enquadramento é normalizado. Daí a largura fictícia de
 * 1000.
 */
export async function recortarFoto({
  uri,
  natural,
  aspect,
  enquadramento,
  larguraFinal = LARGURA_FOTO_FEED,
}: {
  uri: string;
  natural: Tamanho;
  /** Proporção do quadro: largura ÷ altura. */
  aspect: number;
  enquadramento: Enquadramento;
  larguraFinal?: number;
}): Promise<string> {
  const r = retanguloDeCorte(enquadramento, natural, { width: 1000, height: 1000 / aspect });

  // Inteiros: o recorte nativo rejeita fração, e o web arredondaria sozinho de
  // um jeito que não dá para prever. `max(1, …)` protege contra uma foto
  // degenerada virar recorte de tamanho zero.
  const corte = {
    originX: Math.round(r.originX),
    originY: Math.round(r.originY),
    width: Math.max(1, Math.round(r.width)),
    height: Math.max(1, Math.round(r.height)),
  };

  const acoes = [{ crop: corte }];
  if (corte.width > larguraFinal) acoes.push({ resize: { width: larguraFinal } } as never);

  const saida = await manipulateAsync(uri, acoes, {
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return saida.uri;
}
