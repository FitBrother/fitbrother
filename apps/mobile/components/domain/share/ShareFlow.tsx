import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Contrast } from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import { ShareCardSkeleton } from "@/components/domain/ShareCardSkeleton";
import { getMeal, patchMeal } from "@/lib/api/meals";
import { fetchInsight } from "@/lib/api/insights";
import { fetchPost } from "@/lib/api/posts";
import { colors } from "@/lib/colors";
import { useDialog } from "@/lib/dialog/dialog-context";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { pickImage } from "@/lib/media/image-picker";
import { medirImagem } from "@/lib/media/measure-image";
import { Sentry } from "@/lib/sentry";
import { toDisplayableImageUri } from "@/lib/share-card";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";
import {
  arranjoInicial,
  deveSalvarFoto,
  stickersDoPreset,
  tamanhoDoQuadro,
  type StoryPresetId,
} from "@/lib/share/story";
import { presetPorId, presetsDoStory } from "@/lib/share/story-presets";
import { getPostImageSignedUrl, uploadMealPhoto } from "@/lib/storage";
import { useToast } from "@/lib/toast/toast-context";
import { BotaoRedondo, CameraStage } from "./CameraStage";
import { CardPreview } from "./CardPreview";
import { PresetRow } from "./PresetRow";
import { conteudoDoStory, fotoDoCard, StoryCard, temMacros, type StoryCardData } from "./StoryCard";
import { StoryEditor } from "./StoryEditor";

import type { Tamanho } from "@/lib/media/crop";

const ASPECTO = SHARE_CARD_WIDTH / SHARE_CARD_HEIGHT;

/**
 * "11 set" — curto porque entra como sobrelinha, acima da legenda.
 *
 * Montado à mão em vez de `toLocaleDateString({ day, month: "short" })`, que em
 * pt-BR devolve "11 de set." — preposição e ponto final onde a ideia é só datar.
 */
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const mes = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${d.getDate()} ${mes}`;
}

/**
 * Prepara uma imagem para entrar no card sem quebrar a captura.
 *
 * Na web, o html2canvas "tainta" o canvas ao desenhar uma `<img>` cross-origin
 * (as URLs assinadas do Supabase Storage são), e `toDataURL()` passa a lançar
 * SecurityError. Buscar por fetch e converter para data URI resolve na origem.
 * Se falhar, é melhor renderizar sem a imagem do que quebrar o compartilhar.
 */
async function imagemUtilizavel(path: string | null): Promise<string | null> {
  if (!path) return null;
  const assinada = await getPostImageSignedUrl(path).catch(() => null);
  if (!assinada) return null;
  return toDisplayableImageUri(assinada).catch(() => (Platform.OS === "web" ? null : assinada));
}

async function loadCardData(type: string, id: string): Promise<StoryCardData> {
  if (type === "meal") {
    const m = await getMeal(id);
    return {
      kind: "meal",
      // Os itens, não só o primeiro: "Peito de frango grelhado" sozinho conta
      // um terço de um prato que também tinha arroz e salada. O `truncate` do
      // card corta o excedente, então a lista pode entrar inteira.
      headline: m.items.map((i) => i.description).join(" · ") || null,
      imageUrl: await imagemUtilizavel(m.image_path ?? null),
      temFotoSalva: Boolean(m.image_path),
      kcal: m.total_kcal,
      protein_g: m.total_protein_g,
      carbs_g: m.total_carbs_g,
      fat_g: m.total_fat_g,
      dateLabel: dateLabel(m.consumed_at),
    };
  }

  if (type === "post") {
    const p = await fetchPost(id);
    return {
      kind: "meal",
      headline: p.caption,
      imageUrl: await imagemUtilizavel(p.image_path),
      temFotoSalva: Boolean(p.image_path),
      kcal: p.total_kcal,
      protein_g: p.total_protein_g,
      carbs_g: p.total_carbs_g,
      fat_g: p.total_fat_g,
      dateLabel: dateLabel(p.created_at),
    };
  }

  const ins = await fetchInsight(id);
  return {
    kind: "insight",
    title: ins.payload.title,
    headline: ins.payload.headline,
    bullets: ins.payload.bullets,
    score: ins.payload.score,
    dateLabel: dateLabel(ins.created_at),
  };
}

type Etapa = "carregando" | "camera" | "editor";

/** De onde vem a foto que está no editor. */
type Fonte = "local" | "dado" | "nenhuma";

/** Solta o blob ao trocar de foto ou sair: ele prende os bytes até ser revogado. */
function useRevogarBlob(uri: string | null | undefined) {
  useEffect(() => {
    if (!uri?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(uri);
  }, [uri]);
}

/**
 * O caminho inteiro de compartilhar, da câmera ao export.
 *
 * Refeição abre a câmera. Se já tem foto, pergunta antes: abrir a câmera direto
 * deixaria a foto salva sem caminho nenhum, e pedir permissão para quem só quer
 * usar a foto salva seria à toa. Post e análise já têm o que mostrar, então vão
 * direto para o editor.
 *
 * Mora fora de `app/` porque toda pasta lá vira rota, e um arquivo de teste
 * viraria uma.
 */
export function ShareFlow({ type, id }: { type: string; id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useDialog();
  const session = useAuthSession();
  const janela = useWindowDimensions();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;

  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [fonte, setFonte] = useState<Fonte>("nenhuma");
  // A foto tirada agora. Vive só nesta visita à tela: o export usa esta uri, sem
  // esperar upload, e voltar à câmera a descarta.
  const [fotoLocal, setFotoLocal] = useState<string | null>(null);
  const [fotoNatural, setFotoNatural] = useState<Tamanho | null>(null);
  const [presetCamera, setPresetCamera] = useState<StoryPresetId>("completo");
  const [vinhetaCamera, setVinhetaCamera] = useState(true);

  const decidiu = useRef(false);
  const jaSalvou = useRef(false);

  const q = useQuery({
    queryKey: ["share-card", type, id],
    queryFn: () => loadCardData(type, id),
    enabled: Boolean(type && id),
    // Sem cache entre visitas: na web a foto do card é um blob URL, revogado
    // ao sair da tela. Um dado em cache apontando para um blob já revogado
    // renderizaria o card sem foto, em silêncio.
    gcTime: 0,
  });
  const dados = q.data;
  const fotoDoDado = dados ? fotoDoCard(dados) : null;
  useRevogarBlob(fotoDoDado);
  useRevogarBlob(fotoLocal);

  const foto = fonte === "local" ? fotoLocal : fonte === "dado" ? fotoDoDado : null;

  const abrirComFotoDoDado = useCallback(async (uri: string | null) => {
    setFotoNatural(uri ? await medirImagem(uri).catch(() => null) : null);
    setFonte(uri ? "dado" : "nenhuma");
    setEtapa("editor");
  }, []);

  useEffect(() => {
    if (!dados || decidiu.current) return;
    decidiu.current = true;

    (async () => {
      const salva = fotoDoCard(dados);
      if (type !== "meal") {
        await abrirComFotoDoDado(salva);
        return;
      }
      if (!salva) {
        setEtapa("camera");
        return;
      }
      const usar = await confirm({
        title: "Usar a foto salva?",
        description: "Esta refeição já tem uma foto.",
        confirmLabel: "Usar a foto salva",
        cancelLabel: "Tirar outra",
      });
      if (usar) await abrirComFotoDoDado(salva);
      else setEtapa("camera");
    })();
  }, [dados, type, confirm, abrirComFotoDoDado]);

  /**
   * Sobe a foto e aponta a refeição para ela, em paralelo.
   *
   * Deliberadamente não bloqueia: o card já funciona com a uri local, e quem
   * abriu esta tela queria compartilhar, não salvar. Falha de rede só custa a
   * persistência, e libera o próximo export para tentar de novo.
   */
  const persistirFoto = useCallback(
    (uri: string) => {
      if (!userId) return;
      jaSalvou.current = true;
      (async () => {
        try {
          await uploadMealPhoto({ userId, mealId: id, fileUri: uri });
          await patchMeal(id, { has_photo: true });
        } catch (err) {
          jaSalvou.current = false;
          console.warn("[share-card] persistir foto falhou:", err);
          Sentry.captureException(err);
          toast({ variant: "error", message: "A foto não foi salva na refeição." });
        }
      })();
    },
    [id, userId, toast],
  );

  const aoExportar = useCallback(() => {
    if (!fotoLocal || !dados) return;
    const temFotoSalva = dados.kind === "meal" && dados.temFotoSalva;
    if (deveSalvarFoto({ type, fotoLocal, temFotoSalva, jaSalvou: jaSalvou.current })) {
      persistirFoto(fotoLocal);
    }
  }, [type, dados, fotoLocal, persistirFoto]);

  const abrirComFotoLocal = useCallback((uri: string, tamanho: Tamanho | null) => {
    setFotoLocal(uri);
    setFotoNatural(tamanho);
    setFonte("local");
    setEtapa("editor");
  }, []);

  /**
   * Falha ao congelar o frame — não é câmera indisponível.
   *
   * A câmera continua aberta, porque tentar de novo costuma funcionar.
   */
  const aoFalharCaptura = useCallback(
    (err: unknown) => {
      console.error("[share-card] captura falhou:", err);
      Sentry.captureException(err);
      toast({ variant: "error", message: "Não foi possível capturar a foto. Tente de novo." });
    },
    [toast],
  );

  async function daGaleria() {
    const uri = await pickImage();
    if (!uri) return;
    // Foto de celular chega com 12 MP: reduz uma vez aqui, ou o editor e o
    // html2canvas carregam tudo isso a cada gesto e a cada export.
    const reduzida = await toDisplayableImageUri(uri).catch(() => uri);
    abrirComFotoLocal(reduzida, await medirImagem(reduzida).catch(() => null));
  }

  function semFoto() {
    setFotoLocal(null);
    setFotoNatural(null);
    setFonte("nenhuma");
    setEtapa("editor");
  }

  /** Volta à câmera e descarta a foto, como no Instagram. */
  function voltarDoEditor() {
    if (type !== "meal") {
      router.back();
      return;
    }
    setFotoLocal(null);
    setFotoNatural(null);
    setFonte("nenhuma");
    setEtapa("camera");
  }

  const presets = useMemo(
    () => presetsDoStory({ temFoto: true, temMacros: Boolean(dados && temMacros(dados)) }),
    [dados],
  );
  const indiceCamera = Math.max(
    presets.findIndex((p) => p.id === presetCamera),
    0,
  );
  const presetEmCena = presetPorId(presets[indiceCamera]?.id ?? "completo");

  if (q.isError) {
    return (
      <SafeAreaView className="flex-1 bg-ink">
        <View className="flex-row px-2 pt-2">
          <BotaoRedondo rotulo="Voltar" onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.white} />
          </BotaoRedondo>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-sans text-neutral-300">
            Não foi possível carregar este card.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!dados || etapa === "carregando") {
    const quadro = tamanhoDoQuadro(janela, ASPECTO);
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-ink">
        <CardPreview escala={quadro.width / SHARE_CARD_WIDTH}>
          <ShareCardSkeleton />
        </CardPreview>
      </SafeAreaView>
    );
  }

  if (etapa === "editor") {
    const posterFallback = presetPorId("poster");
    return (
      <StoryEditor
        data={dados}
        foto={foto}
        fotoNatural={fotoNatural}
        presetInicial={foto ? presetEmCena.id : posterFallback.id}
        vinhetaInicial={foto ? vinhetaCamera : posterFallback.vinheta}
        onVoltar={voltarDoEditor}
        onExportar={aoExportar}
      />
    );
  }

  const conteudo = conteudoDoStory(dados);
  return (
    <CameraStage
      aspect={ASPECTO}
      rotulo="Compartilhar"
      onCapture={abrirComFotoLocal}
      onGaleria={daGaleria}
      onSemFoto={semFoto}
      onFechar={() => router.back()}
      onErroCaptura={aoFalharCaptura}
      topoDireita={
        <BotaoRedondo
          rotulo={vinhetaCamera ? "Desligar vinheta" : "Ligar vinheta"}
          selecionado={vinhetaCamera}
          onPress={() => setVinhetaCamera((v) => !v)}
        >
          <Contrast size={22} color={vinhetaCamera ? colors.primary[400] : colors.white} />
        </BotaoRedondo>
      }
      sobreposicao={(quadro) => (
        <CardPreview escala={quadro.width / SHARE_CARD_WIDTH} transparente>
          <StoryCard
            data={dados}
            preset={presetEmCena}
            stickers={arranjoInicial(stickersDoPreset(presetEmCena.id, conteudo))}
            vinheta={vinhetaCamera}
            fotoExterna
          />
        </CardPreview>
      )}
      fila={({ disparar, habilitado, ocupado }) => (
        <PresetRow
          presets={presets}
          index={indiceCamera}
          onSelecionar={(i) => {
            const p = presets[i];
            if (!p) return;
            setPresetCamera(p.id);
            setVinhetaCamera(p.vinheta);
          }}
          onCentro={disparar}
          centroDesabilitado={!habilitado}
          rotuloCentro="Tirar foto"
          ocupado={ocupado}
        />
      )}
    />
  );
}
