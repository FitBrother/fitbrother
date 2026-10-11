import { describe, expect, test } from "@jest/globals";
import {
  aceitaDegradar,
  CONSTRAINTS_MINIMAS,
  constraintsDeCamera,
  erroDeCamera,
  RESOLUCAO_ALVO,
} from "./camera-constraints";

/** `DOMException` com um `name` específico, que é o que o getUserMedia rejeita. */
function erroDom(name: string): DOMException {
  return new DOMException("falhou", name);
}

describe("constraintsDeCamera", () => {
  test("pede a câmera traseira e a resolução alvo", () => {
    const c = constraintsDeCamera();
    expect(c.audio).toBe(false);
    expect(c.video).toEqual({
      facingMode: { ideal: "environment" },
      width: { ideal: 1080 },
      height: { ideal: 1920 },
    });
  });

  test("o alvo é o retrato que casa com o card exportado", () => {
    // 360×640 do card × SHARE_EXPORT_SCALE 3 = 1080×1920. Pedir paisagem faria
    // o lado curto cair para 1080/1.78 e o export viraria upscale.
    expect(RESOLUCAO_ALVO).toEqual({ width: 1080, height: 1920 });
  });

  test("aceita um alvo diferente sem mexer no resto", () => {
    const c = constraintsDeCamera({ width: 720, height: 1280 });
    expect(c.video).toMatchObject({ width: { ideal: 720 }, height: { ideal: 1280 } });
  });

  test("as constraints mínimas não pedem resolução nenhuma", () => {
    // É o fallback do OverconstrainedError: sem pedido de tamanho, o
    // navegador entrega o que tiver em vez de recusar o stream.
    expect(CONSTRAINTS_MINIMAS).toEqual({ audio: false, video: true });
  });
});

describe("erroDeCamera", () => {
  test("permissão negada", () => {
    expect(erroDeCamera(erroDom("NotAllowedError"))).toBe("negada");
    // Safari usa SecurityError quando a origem não é segura o bastante.
    expect(erroDeCamera(erroDom("SecurityError"))).toBe("negada");
  });

  test("sem câmera no aparelho", () => {
    expect(erroDeCamera(erroDom("NotFoundError"))).toBe("sem_camera");
    expect(erroDeCamera(erroDom("DevicesNotFoundError"))).toBe("sem_camera");
  });

  test("qualquer outra coisa é indisponível", () => {
    expect(erroDeCamera(erroDom("NotReadableError"))).toBe("indisponivel");
    expect(erroDeCamera(new Error("getUserMedia ausente"))).toBe("indisponivel");
    expect(erroDeCamera(undefined)).toBe("indisponivel");
  });
});

describe("aceitaDegradar", () => {
  test("só o erro de constraint impossível vale uma segunda tentativa", () => {
    expect(aceitaDegradar(erroDom("OverconstrainedError"))).toBe(true);
    expect(aceitaDegradar(erroDom("ConstraintNotSatisfiedError"))).toBe(true);
    // Negar permissão de novo, sem constraint, seria pedir duas vezes a mesma
    // coisa e levar dois "não" na cara do usuário.
    expect(aceitaDegradar(erroDom("NotAllowedError"))).toBe(false);
    expect(aceitaDegradar(erroDom("NotFoundError"))).toBe(false);
  });
});
