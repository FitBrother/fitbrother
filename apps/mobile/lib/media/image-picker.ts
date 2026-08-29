import * as ImagePicker from "expo-image-picker";

type PickImageOptions = {
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
};

/**
 * Abre a galeria e devolve o uri da imagem escolhida (ou null se cancelado).
 * No shim web do expo-image-picker isso abre um <input type="file"> nativo,
 * sem necessidade de branch por Platform.OS.
 */
export async function pickImage(options: PickImageOptions = {}): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: options.allowsEditing ?? false,
    aspect: options.aspect,
    quality: options.quality ?? 0.75,
  });
  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}
