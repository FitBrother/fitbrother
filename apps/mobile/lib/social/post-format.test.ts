import { describe, expect, test } from "@jest/globals";
import { feedSection, macroEnergySplit, relativeTime } from "./post-format";

const AGORA = Date.parse("2026-09-11T15:00:00.000Z");

function atras(ms: number): string {
  return new Date(AGORA - ms).toISOString();
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

describe("relativeTime", () => {
  test("abaixo de um minuto é 'agora'", () => {
    expect(relativeTime(atras(30_000), AGORA)).toBe("agora");
  });

  test("minutos e horas truncam, não arredondam", () => {
    expect(relativeTime(atras(59 * MINUTO), AGORA)).toBe("59 min");
    // 1h59 continua sendo "1 h": arredondar mostraria um tempo que ainda não passou.
    expect(relativeTime(atras(HORA + 59 * MINUTO), AGORA)).toBe("1 h");
    expect(relativeTime(atras(23 * HORA), AGORA)).toBe("23 h");
  });

  test("de um dia a uma semana conta em dias", () => {
    expect(relativeTime(atras(DIA), AGORA)).toBe("1 d");
    expect(relativeTime(atras(6 * DIA), AGORA)).toBe("6 d");
  });

  test("acima de uma semana vira data absoluta", () => {
    expect(relativeTime("2026-08-20T12:00:00.000Z", AGORA)).toMatch(/ago/);
  });

  test("relógio adiantado do cliente não produz tempo negativo", () => {
    expect(relativeTime(new Date(AGORA + 5 * MINUTO).toISOString(), AGORA)).toBe("agora");
  });
});

describe("feedSection", () => {
  // Meia-noite local, para os limites baterem com o que setHours(0,0,0,0) faz.
  const meioDia = new Date(2026, 8, 11, 12, 0, 0).getTime();

  test("separa hoje de ontem pelo dia de calendário, não por 24h", () => {
    const ontemTarde = new Date(2026, 8, 10, 23, 0, 0).toISOString();
    // 13h de idade, mas é ontem — é assim que a pessoa lembra do post.
    expect(feedSection(ontemTarde, meioDia)).toBe("ontem");

    const hojeCedo = new Date(2026, 8, 11, 1, 0, 0).toISOString();
    expect(feedSection(hojeCedo, meioDia)).toBe("hoje");
  });

  test("classifica a semana e o que veio antes", () => {
    expect(feedSection(new Date(2026, 8, 8, 10, 0, 0).toISOString(), meioDia)).toBe("semana");
    expect(feedSection(new Date(2026, 7, 20, 10, 0, 0).toISOString(), meioDia)).toBe("antes");
  });
});

describe("macroEnergySplit", () => {
  test("divide por calorias, não por gramas", () => {
    // 58g de carbo (232 kcal) vs 19g de gordura (171 kcal): 3x em gramas,
    // mas só 1,36x em energia.
    const split = macroEnergySplit({ protein: 48, carbs: 58, fat: 19 });
    expect(split).not.toBeNull();
    expect(split!.carbs / split!.fat).toBeCloseTo(232 / 171, 5);
  });

  test("as fatias somam 1", () => {
    const split = macroEnergySplit({ protein: 30, carbs: 40, fat: 10 })!;
    expect(split.protein + split.carbs + split.fat).toBeCloseTo(1, 10);
  });

  test("sem energia declarada devolve null em vez de barra vazia", () => {
    expect(macroEnergySplit({ protein: 0, carbs: 0, fat: 0 })).toBeNull();
  });

  test("macro negativo não vira fatia", () => {
    const split = macroEnergySplit({ protein: -10, carbs: 40, fat: 0 })!;
    expect(split.protein).toBe(0);
    expect(split.carbs).toBe(1);
  });
});
