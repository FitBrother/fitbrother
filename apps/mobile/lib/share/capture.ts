import { captureRef } from "react-native-view-shot";
import type { RefObject } from "react";
import type { View } from "react-native";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, SHARE_EXPORT_SCALE } from "./geometry";

/**
 * Captura o card como PNG e devolve o uri de um arquivo temporário.
 *
 * Esta é a versão nativa. A web tem a própria em `capture.web.ts` — ver o
 * comentário de lá para o porquê de não dar para usar esta nas duas.
 */
export async function captureCard(ref: RefObject<View | null>): Promise<string> {
  if (!ref.current) throw new Error("share_card_ref_missing");
  return captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
    width: SHARE_CARD_WIDTH * SHARE_EXPORT_SCALE,
    height: SHARE_CARD_HEIGHT * SHARE_EXPORT_SCALE,
  });
}
