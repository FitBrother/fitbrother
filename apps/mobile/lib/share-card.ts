import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import type { RefObject } from "react";
import { Platform, type View } from "react-native";

/** Captura a view referenciada como PNG temporário e devolve o uri. */
export async function captureCard(ref: RefObject<View | null>): Promise<string> {
  if (!ref.current) throw new Error("share_card_ref_missing");
  return captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
}

/**
 * Na web, a captura do card usa html2canvas, que "tainta" o canvas ao
 * desenhar uma <img> cross-origin (ex.: signed URL do Supabase Storage) sem
 * modo CORS — depois disso, toDataURL() lança SecurityError. Buscar a imagem
 * via fetch (mesma origem lógica, resposta lida em memória) e convertê-la
 * pra data URI evita esse cross-origin por completo antes de chegar no
 * <Image>. No nativo isso não se aplica (RNViewShot não usa canvas).
 */
export async function toDisplayableImageUri(url: string): Promise<string> {
  if (Platform.OS !== "web") return url;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image_fetch_failed_${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("file_reader_failed"));
    reader.readAsDataURL(blob);
  });
}

/** Converte uma data URI base64 num File, pra Web Share API / download. */
function dataUriToFile(dataUri: string, filename: string): File {
  const commaIndex = dataUri.indexOf(",");
  const header = dataUri.slice(0, commaIndex);
  const base64 = dataUri.slice(commaIndex + 1);
  const mime = header.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/** Baixa a data URI como arquivo via um <a download> temporário. */
function downloadDataUri(dataUri: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUri;
  link.download = filename;
  link.click();
}

/** Abre o share sheet nativo com a imagem (Web Share API na web). */
export async function shareCard(uri: string): Promise<void> {
  if (Platform.OS === "web") {
    const file = dataUriToFile(uri, "fitbrother-card.png");
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Fitbrother" });
      return;
    }
    downloadDataUri(uri, "fitbrother-card.png");
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
    downloadDataUri(uri, "fitbrother-card.png");
    return;
  }

  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error("gallery_permission_denied");
  await MediaLibrary.saveToLibraryAsync(uri);
}
