/**
 * @jest-environment jsdom
 *
 * Este é o único teste do app que renderiza com `react-dom` em vez do
 * `@testing-library/react-native`, e tem motivo: o RNTL usa
 * `react-test-renderer`, que produz uma árvore de objetos JS e **não** nós DOM.
 * O componente guarda uma ref para o `<video>` e chama `capturarFrame(video)`,
 * então sob o RNTL `video.current` é sempre null e `capturar()` sai pelo guard
 * sem fazer nada. (O RNTL não disfarça isso: o teste falha, porque `onCapture`
 * nunca é chamado. Faltava ferramenta, não vigilância.)
 *
 * `react-dom` já é dependência (é como a web roda), então isto não traz pacote
 * novo — `@testing-library/react` traria.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";

const mockCapturarFrame =
  jest.fn<() => Promise<{ uri: string; tamanho: { width: number; height: number } }>>();
// `mock` no nome não é estilo: o jest hoista a factory acima dos imports e
// recusa referência a variável de fora do escopo, exceto com esse prefixo.
jest.mock("@/lib/media/frame-capture.web", () => ({
  capturarFrame: () => mockCapturarFrame(),
}));

import { CameraLive, type CameraLiveHandle } from "./CameraLive.web";

import type { ReactElement } from "react";

const stopTrack = jest.fn();
const getUserMedia = jest.fn<() => Promise<MediaStream>>();
const originalMediaDevices = navigator.mediaDevices;

function streamFake() {
  return { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
}

function erroDom(name: string) {
  return new DOMException("falhou", name);
}

const ASPECTO = 360 / 640;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

/** Monta e deixa o efeito de abrir a câmera terminar. */
async function montar(ui: ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  await act(async () => {
    r.render(ui);
  });
}

describe("CameraLive na web", () => {
  beforeEach(() => {
    // O React 19 exige esta flag para o `act` não avisar que está fora de
    // ambiente de teste.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    stopTrack.mockReset();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue(streamFake());
    mockCapturarFrame.mockReset();
    mockCapturarFrame.mockResolvedValue({
      uri: "blob:frame",
      tamanho: { width: 1080, height: 1920 },
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    // O jsdom não implementa `play()` em HTMLMediaElement — sem isto o efeito
    // estoura em "not implemented" antes de marcar a câmera como pronta.
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: jest.fn(() => Promise.resolve()),
    });
  });

  afterEach(async () => {
    if (root) {
      const r = root;
      root = null;
      await act(async () => {
        r.unmount();
      });
    }
    container?.remove();
    container = null;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  test("pede a câmera traseira em 1080×1920", async () => {
    await montar(<CameraLive aspect={ASPECTO} onCapture={jest.fn()} onError={jest.fn()} />);

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1080 },
        height: { ideal: 1920 },
      },
    });
  });

  test("tenta de novo sem resolução quando a câmera recusa o tamanho", async () => {
    getUserMedia.mockRejectedValueOnce(erroDom("OverconstrainedError"));
    const onError = jest.fn();

    await montar(<CameraLive aspect={ASPECTO} onCapture={jest.fn()} onError={onError} />);

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia).toHaveBeenLastCalledWith({ audio: false, video: true });
    expect(onError).not.toHaveBeenCalled();
  });

  test("permissão negada avisa sem segunda tentativa", async () => {
    getUserMedia.mockRejectedValue(erroDom("NotAllowedError"));
    const onError = jest.fn();

    await montar(<CameraLive aspect={ASPECTO} onCapture={jest.fn()} onError={onError} />);

    // Uma chamada só: pedir de novo mostraria o diálogo duas vezes para
    // receber o mesmo "não".
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith("negada");
  });

  test("sem getUserMedia nenhum, avisa indisponível", async () => {
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    const onError = jest.fn();

    await montar(<CameraLive aspect={ASPECTO} onCapture={jest.fn()} onError={onError} />);

    // É o caso de http sem TLS e de webview do Instagram — o que faz a tela
    // cair para a galeria.
    expect(onError).toHaveBeenCalledWith("indisponivel");
  });

  test("renderiza um <video> de verdade e liga o stream nele", async () => {
    await montar(<CameraLive aspect={ASPECTO} onCapture={jest.fn()} onError={jest.fn()} />);

    // É a premissa de todo o resto: sem nó DOM, `capturar()` não tem o que ler.
    const video = container!.querySelector("video");
    expect(video).not.toBeNull();
    expect(video!.srcObject).not.toBeNull();
  });

  test("capturar entrega uri e tamanho", async () => {
    const onCapture = jest.fn();
    const ref = createRef<CameraLiveHandle>();

    await montar(
      <CameraLive ref={ref} aspect={ASPECTO} onCapture={onCapture} onError={jest.fn()} />,
    );
    await act(async () => {
      await ref.current?.capturar();
    });

    expect(onCapture).toHaveBeenCalledWith("blob:frame", { width: 1080, height: 1920 });
  });

  test("para os tracks ao desmontar", async () => {
    await montar(<CameraLive aspect={ASPECTO} onCapture={jest.fn()} onError={jest.fn()} />);

    const r = root!;
    root = null;
    await act(async () => {
      r.unmount();
    });

    // Sem isso a luz da câmera fica acesa depois de sair da tela — é o que o
    // CameraView do expo-camera deixa acontecer em alguns casos.
    expect(stopTrack).toHaveBeenCalled();
  });
});
