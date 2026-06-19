import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import type { RefObject } from "react";
import type { View } from "react-native";

/** Captura a view referenciada como PNG temporário e devolve o uri. */
export async function captureCard(ref: RefObject<View>): Promise<string> {
  if (!ref.current) throw new Error("share_card_ref_missing");
  return captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
}

/** Abre o share sheet nativo com a imagem. */
export async function shareCard(uri: string): Promise<void> {
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
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error("gallery_permission_denied");
  await MediaLibrary.saveToLibraryAsync(uri);
}
