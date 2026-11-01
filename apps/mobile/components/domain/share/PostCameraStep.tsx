import { useCallback } from "react";
import { FEED_PHOTO_ASPECT } from "@/lib/media/feed-photo";
import { pickImage } from "@/lib/media/image-picker";
import { Sentry } from "@/lib/sentry";
import { useToast } from "@/lib/toast/toast-context";
import { CameraStage } from "./CameraStage";

/**
 * A câmera do "Novo post": a mesma do story, no quadro 4:5 do feed.
 *
 * Sem fila de presets, porque no feed calorias e macros já aparecem abaixo da
 * foto. O enquadramento continua sendo do `PhotoAdjuster`, no formulário.
 */
export function PostCameraStep({
  onFoto,
  onSemFoto,
  onFechar,
}: {
  onFoto: (uri: string) => void;
  onSemFoto: () => void;
  onFechar: () => void;
}) {
  const toast = useToast();

  const aoFalharCaptura = useCallback(
    (err: unknown) => {
      console.error("[novo-post] captura falhou:", err);
      Sentry.captureException(err);
      toast({ variant: "error", message: "Não foi possível capturar a foto. Tente de novo." });
    },
    [toast],
  );

  // `quality: 1` porque quem comprime é o recorte, no fim.
  async function daGaleria() {
    const uri = await pickImage({ quality: 1 });
    if (uri) onFoto(uri);
  }

  return (
    <CameraStage
      aspect={FEED_PHOTO_ASPECT}
      rotulo="Novo post"
      onCapture={(uri) => onFoto(uri)}
      onGaleria={daGaleria}
      onSemFoto={onSemFoto}
      onFechar={onFechar}
      onErroCaptura={aoFalharCaptura}
    />
  );
}
