import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import type { LayoutChangeEvent, View as RNView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  ChevronLeft,
  Crop,
  Download,
  Image as ImageIcon,
  RotateCcw,
  Share2,
} from "lucide-react-native";
import { useQuery } from "@tanstack/react-query";
import {
  fotoDoCard,
  ShareCard,
  temMacros,
  type ShareCardData,
} from "@/components/domain/ShareCard";
import { ShareCardSkeleton } from "@/components/domain/ShareCardSkeleton";
import { CardPreview } from "@/components/domain/share/CardPreview";
import { ShareAdjustStage } from "@/components/domain/share/ShareAdjustStage";
import { SharePresetCarousel } from "@/components/domain/share/SharePresetCarousel";
import { ShareCameraStage } from "@/components/domain/share/ShareCameraStage";
import { captureCard, saveCardToGallery, shareCard, toDisplayableImageUri } from "@/lib/share-card";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/share/geometry";
import { ENQUADRAMENTO_PADRAO, type Enquadramento, type Tamanho } from "@/lib/media/crop";
import { medirImagem } from "@/lib/media/measure-image";
import {
  DEFAULT_PRESET_INDEX,
  presetAt,
  presetsFor,
  type SharePresetId,
} from "@/lib/share/presets";
import { getMeal, patchMeal } from "@/lib/api/meals";
import { fetchPost } from "@/lib/api/posts";
import { fetchInsight } from "@/lib/api/insights";
import { useToast } from "@/lib/toast/toast-context";
import { getPostImageSignedUrl, uploadMealPhoto } from "@/lib/storage";
import { pickImage } from "@/lib/media/image-picker";
import { useAuthSession } from "@/lib/hooks/useAuthSession";

import type { CameraErro } from "@/lib/media/camera-constraints";
import { shadows } from "@/lib/shadows";
import { colors } from "@/lib/colors";
import { Sentry } from "@/lib/sentry";

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

async function loadCardData(type: string, id: string): Promise<ShareCardData> {
  if (type === "meal") {
    const m = await getMeal(id);
    return {
      kind: "meal",
      // Os itens, não só o primeiro: "Peito de frango grelhado" sozinho conta
      // um terço de um prato que também tinha arroz e salada. O `truncate` do
      // card corta o excedente, então a lista pode entrar inteira.
      headline: m.items.map((i) => i.description).join(" · ") || null,
      // Foto de refeição deixou de viver só no storage: a 0082 criou
      // `meals.image_path` e fez backfill de quem já registrou por foto. Sem
      // isto, `presetsFor` continuava descartando Moldura, Etiqueta e Discreto
      // em TODA refeição — 4 presets de 7, sempre.
      imageUrl: await imagemUtilizavel(m.image_path ?? null),
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

/**
 * Troca a foto do dado pela que acabou de ser tirada.
 *
 * A foto local vence a do servidor de propósito: ela existe agora, e o export
 * não tem por que esperar o upload terminar para usar o que já está na mão.
 */
function comFoto(data: ShareCardData, uri: string | null): ShareCardData {
  if (!uri || data.kind !== "meal") return data;
  return { ...data, imageUrl: uri };
}

export default function ShareScreen() {
  const router = useRouter();
  const toast = useToast();
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const cardRef = useRef<RNView>(null);

  const [presetIndex, setPresetIndex] = useState(DEFAULT_PRESET_INDEX);

  // A foto tirada agora. Tem prioridade sobre a do servidor, e vive só nesta
  // visita à tela: o export usa esta uri, sem esperar upload.
  const [fotoLocal, setFotoLocal] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [semCamera, setSemCamera] = useState(false);
  const session = useAuthSession();
  const userId = session.status === "signed_in" ? session.session.user.id : undefined;

  const q = useQuery({
    queryKey: ["share-card", type, id],
    queryFn: () => loadCardData(type ?? "", id ?? ""),
    enabled: Boolean(type && id),
    // Sem cache entre visitas: na web a foto do card é um blob URL, revogado
    // ao sair da tela (ver abaixo). Um dado em cache apontando para um blob
    // já revogado renderizaria o card sem foto, em silêncio.
    gcTime: 0,
  });

  // Derivado, e não `q.data` cru: a foto da câmera entra por aqui, então tudo
  // que depende da foto (medição, revogação do blob, lista de presets) vale
  // para ela também.
  const dados = q.data ? comFoto(q.data, fotoLocal) : undefined;
  // Uma só: a foto do card, venha do servidor ou da câmera.
  const foto = dados ? fotoDoCard(dados) : null;

  // Libera o blob da foto ao sair. `URL.createObjectURL` prende os bytes até
  // alguém revogar — sem isso, cada visita à tela deixa uma foto na memória
  // da aba até o reload.
  useEffect(() => {
    if (!foto?.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(foto);
  }, [foto]);

  // A lista depende do conteúdo: "Moldura" precisa de foto para emoldurar, e os
  // minimalistas precisam de foto e de macros. `presetAt` prende o índice,
  // então a lista pode encolher entre renders (dado chegando) sem deixar o
  // carrossel apontando para o vazio.
  const presets = presetsFor({
    temFoto: Boolean(foto),
    temMacros: Boolean(dados && temMacros(dados)),
  });
  const preset = presetAt(presets, presetIndex);

  // Escala do preview: o card mede 640dp de altura e quase nenhuma tela tem
  // isso sobrando depois do header e dos botões. Medimos o espaço livre e
  // encolhemos só na exibição — a captura usa o nó em tamanho cheio.
  const [areaAltura, setAreaAltura] = useState(0);
  const onLayoutArea = useCallback((e: LayoutChangeEvent) => {
    setAreaAltura(e.nativeEvent.layout.height);
  }, []);
  const escala = areaAltura > 0 ? Math.min(1, (areaAltura - 24) / SHARE_CARD_HEIGHT) : 0;

  const [preparando, setPreparando] = useState(false);
  const [enquadramento, setEnquadramento] = useState<Enquadramento>(ENQUADRAMENTO_PADRAO);
  const [ajustando, setAjustando] = useState(false);
  const [fotoNatural, setFotoNatural] = useState<Tamanho | null>(null);

  // Mede a foto uma vez: sem as dimensões naturais não dá para aplicar
  // enquadramento nenhum, e o card cai no `cover` centrado de sempre.
  useEffect(() => {
    if (!foto) {
      setFotoNatural(null);
      return;
    }
    let ativo = true;
    medirImagem(foto)
      .then((t) => ativo && setFotoNatural(t))
      .catch(() => ativo && setFotoNatural(null));
    return () => {
      ativo = false;
    };
  }, [foto]);

  /**
   * Sobe a foto e aponta a refeição para ela, em paralelo.
   *
   * Deliberadamente não bloqueia: o card já funciona com a uri local, e quem
   * abriu esta tela queria compartilhar, não salvar. Falha de rede só custa a
   * persistência.
   *
   * Só vale para `type === "meal"` — um post já tem foto própria, e trocá-la
   * aqui mudaria o que foi publicado no feed.
   */
  const persistirFoto = useCallback(
    (uri: string) => {
      if (type !== "meal" || !id || !userId) return;
      (async () => {
        try {
          await uploadMealPhoto({ userId, mealId: id, fileUri: uri });
          await patchMeal(id, { has_photo: true });
        } catch (err) {
          console.warn("[share-card] persistir foto falhou:", err);
          Sentry.captureException(err);
          toast({ variant: "error", message: "A foto não foi salva na refeição." });
        }
      })();
    },
    [type, id, userId, toast],
  );

  const aoCapturar = useCallback(
    (uri: string, tamanho: Tamanho, presetId: SharePresetId) => {
      setFotoLocal(uri);
      setFotoNatural(tamanho);
      setEnquadramento(ENQUADRAMENTO_PADRAO);
      setCamera(false);
      // Volta ao carrossel completo já no estilo que estava em cena, em vez de
      // jogar a pessoa de volta no primeiro preset.
      const i = presetsFor({ temFoto: true, temMacros: true }).findIndex((p) => p.id === presetId);
      if (i >= 0) setPresetIndex(i);
      persistirFoto(uri);
    },
    [persistirFoto],
  );

  const aoFaltarCamera = useCallback((motivo: CameraErro) => {
    setCamera(false);
    setSemCamera(true);
    console.warn("[share-card] câmera indisponível:", motivo);
  }, []);

  async function daGaleria() {
    const uri = await pickImage();
    if (!uri) return;
    const tamanho = await medirImagem(uri).catch(() => null);
    setFotoLocal(uri);
    setFotoNatural(tamanho);
    setEnquadramento(ENQUADRAMENTO_PADRAO);
    persistirFoto(uri);
  }

  /**
   * Captura o preset em cena, na hora em que a pessoa pede.
   *
   * **Não há pré-captura.** Havia: o card era rasterizado a cada troca de
   * preset, para ter o arquivo pronto dentro da janela de ativação do clique
   * que o `navigator.share()` exige. Só que uma captura é o trabalho mais caro
   * desta tela — clona o DOM, copia estilo por estilo e rasteriza 1080×1920 —
   * e pagá-la a cada preset folheado travava justamente o gesto de folhear.
   *
   * Medido com CPU estrangulada em 6× (celular lento), três arrastos:
   * com pré-captura, 21 travadas de thread principal somando 3803ms, a maior
   * de 538ms; sem ela, 6 travadas somando 843ms, a maior de 255ms. Era 78% do
   * tempo bloqueado, gasto em imagens que quase sempre iam para o lixo.
   *
   * Agora o custo cai no toque, onde esperar é esperado — e com o botão
   * dizendo que está preparando. O preço é o share poder cair fora da janela
   * de ativação; `shareCard` trata isso caindo para o download.
   */
  async function comCaptura(acao: (uri: string) => Promise<void>) {
    setPreparando(true);
    try {
      await acao(await captureCard(cardRef));
    } finally {
      setPreparando(false);
    }
  }

  async function onShare() {
    try {
      await comCaptura(shareCard);
    } catch (err) {
      // Cancelar a folha de compartilhamento rejeita com AbortError — não é
      // falha, a pessoa só desistiu.
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[share-card] onShare falhou:", err);
      Sentry.captureException(err);
      toast({ variant: "error", message: "Não foi possível compartilhar a imagem." });
    }
  }

  async function onSave() {
    try {
      await comCaptura(saveCardToGallery);
      toast({
        variant: "success",
        message: Platform.OS === "web" ? "Imagem baixada!" : "Salvo na galeria!",
      });
    } catch (err) {
      if (err instanceof Error && err.message !== "gallery_permission_denied") {
        console.error("[share-card] onSave falhou:", err);
        Sentry.captureException(err);
      }
      const msg =
        err instanceof Error && err.message === "gallery_permission_denied"
          ? "Permita o acesso às fotos pra salvar."
          : "Não foi possível salvar a imagem.";
      toast({ variant: "error", message: msg });
    }
  }

  // Enquadrar só faz sentido se o preset em cena de fato desenha a foto.
  const podeAjustar = Boolean(foto && fotoNatural && preset.photo !== "none");
  const pronto = Boolean(dados);

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-display-bold text-neutral-800">Compartilhar</Text>
      </View>

      <View className="flex-1" onLayout={onLayoutArea}>
        {q.isLoading ? (
          // Dentro do mesmo `CardPreview` do card de verdade: é ele que
          // arredonda e encolhe para caber na tela. Solto, o esqueleto saía em
          // 360×640 cheios e estourava a área.
          <View className="flex-1 items-center justify-center">
            <CardPreview escala={escala}>
              <ShareCardSkeleton />
            </CardPreview>
          </View>
        ) : dados && camera ? (
          <ShareCameraStage
            data={dados}
            escala={escala}
            onCapture={aoCapturar}
            onIndisponivel={aoFaltarCamera}
          />
        ) : dados && ajustando && foto && fotoNatural ? (
          <ShareAdjustStage uri={foto} value={enquadramento} onChange={setEnquadramento} />
        ) : dados ? (
          <SharePresetCarousel
            presets={presets}
            index={presetIndex}
            onIndexChange={setPresetIndex}
            data={dados}
            enquadramento={enquadramento}
            fotoNatural={fotoNatural}
            escala={escala}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center font-sans text-neutral-600">
              Não foi possível carregar este card.
            </Text>
          </View>
        )}
      </View>

      {pronto && ajustando ? (
        <View className="flex-row items-center gap-3 px-4 pb-4 pt-3">
          <Pressable
            onPress={() => setEnquadramento(ENQUADRAMENTO_PADRAO)}
            accessibilityRole="button"
            accessibilityLabel="Restaurar enquadramento original"
            style={shadows.card}
            className="min-h-[56px] flex-row items-center justify-center gap-2 rounded-full bg-white px-5 active:opacity-70"
          >
            <RotateCcw size={18} color={colors.neutral[700]} />
            <Text className="font-sans-semibold text-neutral-700">Restaurar</Text>
          </Pressable>
          <Pressable
            onPress={() => setAjustando(false)}
            accessibilityRole="button"
            accessibilityLabel="Concluir ajuste da foto"
            style={shadows.card}
            className="min-h-[56px] flex-1 items-center justify-center rounded-full bg-primary-400 active:bg-primary-500"
          >
            <Text className="text-base font-sans-bold text-white">Pronto</Text>
          </Pressable>
        </View>
      ) : pronto && !camera ? (
        // No modo câmera o próprio palco desenha label e bolinhas, da lista ao
        // vivo (cinco), não desta (até sete) — deixar as duas aparecendo
        // mostraria contagens diferentes para o mesmo carrossel.
        <View className="items-center pb-1 pt-3">
          <Text className="font-sans-medium text-sm text-neutral-600">{preset.label}</Text>
          <View className="mt-2 flex-row gap-1.5">
            {presets.map((p, i) => (
              <View
                key={p.id}
                className={[
                  "h-1.5 rounded-full",
                  i === presetIndex ? "w-5 bg-primary-400" : "w-1.5 bg-neutral-300",
                ].join(" ")}
              />
            ))}
          </View>
          {/* Diz o formato junto com a instrução: as margens de cima e de
              baixo do card são de propósito (é onde o story desenha a própria
              interface), e sem essa linha elas parecem sobra. */}
          <Text className="mt-2 font-sans text-xs text-neutral-400">
            Arraste para trocar de estilo · formato de story
          </Text>
        </View>
      ) : null}

      {semCamera ? (
        <Text className="px-4 pb-1 text-center font-sans text-xs text-neutral-500">
          Sem câmera aqui — escolha uma foto da galeria.
        </Text>
      ) : null}

      {ajustando || camera ? null : (
        <View className="flex-row items-center gap-3 px-4 pb-4 pt-3">
          {/* Só para refeição: post já tem foto própria, e trocá-la aqui
              mudaria o que foi publicado no feed. */}
          {type === "meal" ? (
            <Pressable
              onPress={() => (semCamera ? daGaleria() : setCamera(true))}
              accessibilityRole="button"
              accessibilityLabel={semCamera ? "Escolher foto da galeria" : "Tirar foto da refeição"}
              style={shadows.card}
              className="min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-white active:opacity-70"
            >
              {semCamera ? (
                <ImageIcon size={22} color={colors.neutral[700]} />
              ) : (
                <Camera size={22} color={colors.neutral[700]} />
              )}
            </Pressable>
          ) : null}
          {/* Só aparece quando o preset em cena usa a foto: nos que a ignoram
            (Pôster, e qualquer um quando o post não tem foto) não há o que
            enquadrar, e um botão morto vale menos que nenhum botão. */}
          {podeAjustar ? (
            <Pressable
              onPress={() => setAjustando(true)}
              accessibilityRole="button"
              accessibilityLabel="Ajustar enquadramento da foto"
              style={shadows.card}
              className="min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-white active:opacity-70"
            >
              <Crop size={22} color={colors.neutral[700]} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSave}
            disabled={!pronto || preparando}
            accessibilityRole="button"
            accessibilityLabel={Platform.OS === "web" ? "Baixar imagem" : "Salvar na galeria"}
            style={shadows.card}
            className="min-h-[56px] min-w-[56px] items-center justify-center rounded-full bg-white disabled:opacity-50"
          >
            <Download size={22} color={colors.neutral[700]} />
          </Pressable>
          {/* Um primário só, largo e rotulado — a ação que a tela existe para
            oferecer não pode disputar espaço igual com "salvar".
            Como a imagem só é gerada agora, no toque, o botão diz enquanto
            gera: sem isso o app parecia ter engasgado. */}
          <Pressable
            onPress={onShare}
            disabled={!pronto || preparando}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar imagem"
            style={shadows.card}
            className="min-h-[56px] flex-1 flex-row items-center justify-center gap-2 rounded-full bg-primary-400 active:bg-primary-500 disabled:opacity-50"
          >
            {preparando ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Share2 size={20} color={colors.white} />
            )}
            <Text className="text-base font-sans-bold text-white">
              {preparando ? "Gerando imagem…" : "Compartilhar"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Palco de captura: o card em tamanho cheio, fora da tela.
          Capturar o card do carrossel daria problema — ele vive dentro de um
          `Animated.View` com translateX, e tanto o html2canvas quanto a escala
          do preview mudariam a geometria do PNG. Aqui o nó não tem transform
          nenhum e mede exatamente 360×640. */}
      {dados ? (
        <View
          ref={cardRef}
          collapsable={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: "absolute",
            left: -9999,
            top: 0,
            width: SHARE_CARD_WIDTH,
            height: SHARE_CARD_HEIGHT,
            pointerEvents: "none",
          }}
        >
          <ShareCard
            data={dados}
            preset={preset}
            enquadramento={enquadramento}
            fotoNatural={fotoNatural}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
