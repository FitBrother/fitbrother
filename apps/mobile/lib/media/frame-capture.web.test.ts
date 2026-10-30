/**
 * @jest-environment jsdom
 *
 * Primeiro `@jest-environment` do repositório, e com motivo: o preset
 * `jest-expo` roda em ambiente node, onde `navigator` e `DOMException` existem
 * (é por isso que `lib/audio/recorder.test.ts` funciona sem isto) mas
 * `document` **não**. Este módulo cria um `<canvas>` via
 * `document.createElement`, então sem jsdom não há o que espionar.
 *
 * Só o `document` vem do jsdom — o canvas em si é mockado abaixo, porque o
 * jsdom não implementa `getContext("2d")` nem `toBlob` sem o pacote `canvas`.
 */
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { capturarFrame } from "./frame-capture.web";

const drawImage = jest.fn();
const toBlob = jest.fn<(cb: (b: Blob | null) => void, tipo?: string, q?: number) => void>();
const getContext = jest.fn();

/** Canvas fake: só o que o `capturarFrame` usa. */
function canvasFake() {
  return { width: 0, height: 0, getContext, toBlob } as unknown as HTMLCanvasElement;
}

/** `<video>` fake com dimensões de frame. */
function videoFake(width: number, height: number) {
  return { videoWidth: width, videoHeight: height } as unknown as HTMLVideoElement;
}

describe("capturarFrame", () => {
  beforeEach(() => {
    drawImage.mockReset();
    getContext.mockReset();
    getContext.mockReturnValue({ drawImage } as never);
    toBlob.mockReset();
    toBlob.mockImplementation((cb) => cb(new Blob(["jpeg"], { type: "image/jpeg" })));
    jest.spyOn(document, "createElement").mockReturnValue(canvasFake() as never);
    jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:frame");
  });

  test("devolve blob URL e as dimensões reais do frame", async () => {
    const r = await capturarFrame(videoFake(1080, 1920));

    expect(r.uri).toBe("blob:frame");
    // O tamanho tem que ser o do FRAME, não o do elemento na tela: é ele que
    // o Enquadramento normalizado usa como medida natural da foto.
    expect(r.tamanho).toEqual({ width: 1080, height: 1920 });
  });

  test("desenha o frame inteiro, sem recorte", async () => {
    await capturarFrame(videoFake(1280, 720));

    // Guardamos o frame inteiro de propósito: a mesma foto serve o card 9:16,
    // a Home e um share futuro. Gravar o recorte aqui destruiria os outros.
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 720);
  });

  test("pede JPEG, não PNG", async () => {
    await capturarFrame(videoFake(1080, 1920));

    // PNG de 1080×1920 é grande o bastante para pesar na memória da aba e no
    // upload, e foto de comida não ganha nada com sem-perdas.
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.9);
  });

  test("recusa frame sem dados em vez de devolver imagem vazia", async () => {
    await expect(capturarFrame(videoFake(0, 0))).rejects.toThrow("frame_sem_dados");
  });

  test("propaga falha do toBlob", async () => {
    toBlob.mockImplementation((cb) => cb(null));
    await expect(capturarFrame(videoFake(1080, 1920))).rejects.toThrow("frame_to_blob_failed");
  });
});
