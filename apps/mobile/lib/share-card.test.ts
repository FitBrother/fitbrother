import { afterEach, describe, expect, jest, test } from "@jest/globals";
import { Platform } from "react-native";
import { podeCompartilharArquivos } from "./share-card";

jest.mock("./share/capture", () => ({ captureCard: jest.fn(), blobCapturado: jest.fn() }));

const navegador = navigator as unknown as { canShare?: (d: unknown) => boolean };

describe("podeCompartilharArquivos", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete navegador.canShare;
  });

  test("no nativo, sim", () => {
    jest.replaceProperty(Platform, "OS", "ios");
    expect(podeCompartilharArquivos()).toBe(true);
  });

  test("navegador sem canShare, não", () => {
    jest.replaceProperty(Platform, "OS", "web");
    expect(podeCompartilharArquivos()).toBe(false);
  });

  test("navegador que recusa arquivo, não", () => {
    jest.replaceProperty(Platform, "OS", "web");
    navegador.canShare = () => false;
    expect(podeCompartilharArquivos()).toBe(false);
  });

  test("navegador que aceita arquivo, sim", () => {
    jest.replaceProperty(Platform, "OS", "web");
    navegador.canShare = () => true;
    expect(podeCompartilharArquivos()).toBe(true);
  });
});
