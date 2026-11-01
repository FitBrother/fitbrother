import { useEffect, useMemo, useRef } from "react";
import { Platform } from "react-native";
import { Gesture, PointerType } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import {
  alvoDoToque,
  dentroDaLixeira,
  moverFoto,
  moverSticker,
  prenderLogo,
  prenderSticker,
  trazerParaFrente,
  zoomDaRoda,
  type Caixa,
  type FotoLivre,
  type PassoDeGesto,
  type Sticker,
  type StickerId,
} from "@/lib/share/story";

import type { RefObject } from "react";
import type { View } from "react-native";
import type { SharedValue } from "react-native-reanimated";

/** Quem o conjunto de dedos está mexendo. Fica fixo até todos saírem. */
type Alvo = StickerId | "foto" | "nada" | "";

const SEM_ALVO = "";
const FOTO = "foto";
const NADA = "nada";

const PAN = 1;
const PINCA = 2;
const GIRO = 4;

/** Espera da roda do mouse antes de passar o resultado para o estado. */
const FIM_DA_RODA_MS = 120;

type Opcoes = {
  /** Tamanho do quadro na tela dividido pelo tamanho do card. */
  escala: number;
  temFoto: boolean;
  stickers: SharedValue<Sticker[]>;
  foto: SharedValue<FotoLivre>;
  caixas: SharedValue<Partial<Record<StickerId, Caixa>>>;
  /** Avisa que um sticker removível começou a ser arrastado. */
  onArrastar: (arrastando: boolean) => void;
  /** Todos os dedos saíram. `removido` é o sticker solto na lixeira. */
  onFim: (removido: StickerId | null, stickers: Sticker[], foto: FotoLivre) => void;
  /** A camada que recebe a roda do mouse, na web. */
  camada: RefObject<View | null>;
};

/**
 * Os gestos do editor: UM detector cobrindo o quadro, com hit-test próprio.
 *
 * Um detector por sticker não serviria. O logo tem 18dp de altura: não cabem
 * dois dedos nele, e o segundo cairia fora do sticker. Aqui o alvo é escolhido
 * no primeiro toque e vale para os dedos seguintes, onde quer que caiam, como no
 * Instagram.
 *
 * Tudo é incremental (`changeX`, `scaleChange`, `rotationChange`), nunca o total
 * desde o início: é o que deixa o segundo dedo entrar sem a imagem saltar, e o
 * que permite ignorar o arrasto de um dedo na foto sem acumular essa distância.
 *
 * Os gestos mexem só nos shared values. O estado React recebe o resultado quando
 * todos os dedos saem: re-renderizar a árvore a cada evento é justamente o
 * travamento que já foi reclamado nesta família de telas.
 */
export function useStoryGestos({
  escala,
  temFoto,
  stickers,
  foto,
  caixas,
  onArrastar,
  onFim,
  camada,
}: Opcoes) {
  const alvo = useSharedValue<Alvo>(SEM_ALVO);
  const ativos = useSharedValue(0);
  const arrastando = useSharedValue(false);
  const sobreLixeira = useSharedValue(false);

  const gesto = useMemo(() => {
    function aplicar(d: PassoDeGesto) {
      "worklet";
      const a = alvo.value;
      if (a === FOTO) {
        foto.value = moverFoto(foto.value, d);
        return;
      }
      if (a === SEM_ALVO || a === NADA) return;
      const caixa = caixas.value[a];
      if (!caixa) return;
      stickers.value = stickers.value.map((s) => {
        if (s.id !== a) return s;
        const movido = moverSticker(s, d);
        return a === "logo" ? prenderLogo(movido, caixa) : prenderSticker(movido, caixa);
      });
    }

    function terminar(bit: number) {
      "worklet";
      ativos.value &= ~bit;
      if (ativos.value !== 0) return;
      const a = alvo.value;
      const removido =
        arrastando.value && sobreLixeira.value && a !== FOTO && a !== NADA && a !== SEM_ALVO
          ? a
          : null;
      if (arrastando.value) runOnJS(onArrastar)(false);
      alvo.value = SEM_ALVO;
      arrastando.value = false;
      sobreLixeira.value = false;
      runOnJS(onFim)(removido, stickers.value, foto.value);
    }

    const arrastar = Gesture.Pan()
      .minPointers(1)
      .maxPointers(2)
      .onBegin((e) => {
        ativos.value |= PAN;
        if (alvo.value !== SEM_ALVO) return;
        const p = { x: e.x / escala, y: e.y / escala };
        const id = alvoDoToque(p, stickers.value, caixas.value);
        alvo.value = id ?? (temFoto ? FOTO : NADA);
        if (id) stickers.value = trazerParaFrente(stickers.value, id);
      })
      .onChange((e) => {
        const a = alvo.value;
        // Um dedo fora de um sticker não mexe na foto. O mouse só tem um.
        if (a === FOTO && e.numberOfPointers < 2 && e.pointerType !== PointerType.MOUSE) return;
        aplicar({ dx: e.changeX / escala, dy: e.changeY / escala, k: 1, rot: 0 });

        if (a === FOTO || a === NADA || a === SEM_ALVO || a === "logo") return;
        if (!arrastando.value) {
          arrastando.value = true;
          runOnJS(onArrastar)(true);
        }
        sobreLixeira.value = dentroDaLixeira({ x: e.x / escala, y: e.y / escala });
      })
      .onFinalize(() => terminar(PAN));

    const pincar = Gesture.Pinch()
      .onBegin(() => {
        ativos.value |= PINCA;
      })
      .onChange((e) => aplicar({ dx: 0, dy: 0, k: e.scaleChange, rot: 0 }))
      .onFinalize(() => terminar(PINCA));

    const girar = Gesture.Rotation()
      .onBegin(() => {
        ativos.value |= GIRO;
      })
      .onChange((e) => aplicar({ dx: 0, dy: 0, k: 1, rot: e.rotationChange }))
      .onFinalize(() => terminar(GIRO));

    return Gesture.Simultaneous(arrastar, pincar, girar);
  }, [
    escala,
    temFoto,
    alvo,
    ativos,
    arrastando,
    sobreLixeira,
    stickers,
    foto,
    caixas,
    onArrastar,
    onFim,
  ]);

  // A roda do mouse, só na web. Mexe no que estiver sob o cursor, igual ao toque.
  const fimDaRoda = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || escala <= 0) return;
    const no = camada.current as unknown as HTMLElement | null;
    if (!no) return;

    function aoRolar(e: WheelEvent) {
      e.preventDefault();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const p = { x: (e.clientX - r.left) / escala, y: (e.clientY - r.top) / escala };
      const d = { dx: 0, dy: 0, k: zoomDaRoda(e.deltaY), rot: 0 };

      const id = alvoDoToque(p, stickers.value, caixas.value);
      const caixa = id ? caixas.value[id] : undefined;
      if (id && caixa) {
        stickers.value = stickers.value.map((s) => {
          if (s.id !== id) return s;
          const movido = moverSticker(s, d);
          return id === "logo" ? prenderLogo(movido, caixa) : prenderSticker(movido, caixa);
        });
      } else if (temFoto) {
        foto.value = moverFoto(foto.value, d);
      }

      if (fimDaRoda.current) clearTimeout(fimDaRoda.current);
      fimDaRoda.current = setTimeout(() => onFim(null, stickers.value, foto.value), FIM_DA_RODA_MS);
    }

    // `passive: false`: sem isso o `preventDefault` não segura a rolagem da página.
    no.addEventListener("wheel", aoRolar, { passive: false });
    return () => {
      no.removeEventListener("wheel", aoRolar);
      if (fimDaRoda.current) clearTimeout(fimDaRoda.current);
    };
  }, [camada, escala, temFoto, stickers, foto, caixas, onFim]);

  return { gesto, sobreLixeira };
}
