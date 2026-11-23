/** @jest-environment jsdom */
import { afterEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("html2canvas", () => ({ __esModule: true, default: jest.fn() }));

import { garantirMetricasDeFonte } from "./capture.web";

afterEach(() => {
  document.head.innerHTML = "";
});

describe("garantirMetricasDeFonte", () => {
  test("corrige a <img> que o html2canvas usa para medir o baseline", () => {
    garantirMetricasDeFonte(document);
    expect(document.head.textContent).toContain('body > div[style*="visibility: hidden"] > img');
  });

  test("não duplica o estilo", () => {
    garantirMetricasDeFonte(document);
    garantirMetricasDeFonte(document);
    expect(document.head.querySelectorAll("style[data-share-metricas]")).toHaveLength(1);
  });
});
