import { Image } from "react-native";
import type { Tamanho } from "./crop";

/**
 * Dimensões naturais de uma imagem, como promessa.
 *
 * `Image.getSize` é callback e existe nas duas plataformas (na web o
 * react-native-web resolve com um `new Image()`). Envolver em promessa é o que
 * permite medir dentro do fluxo de publicar sem encadear callback no meio de
 * um `async`.
 */
export function medirImagem(uri: string): Promise<Tamanho> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => reject(new Error("image_size_failed")),
    );
  });
}
