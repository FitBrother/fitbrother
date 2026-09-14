/**
 * Formatação de conteúdo do Feed — tempo relativo, agrupamento por recência e
 * a divisão energética dos macros.
 *
 * Fica em `lib/` e não dentro do componente porque é lógica pura e testável,
 * e porque PostCard e FeedPostsPanel precisam das mesmas regras (o rótulo de
 * um post e o cabeçalho da seção em que ele cai têm que concordar).
 */

/** Quilocalorias por grama de cada macronutriente (fatores de Atwater). */
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Rótulo de tempo de um post.
 *
 * Trunca em vez de arredondar: um post de 119 minutos é "1 h", não "2 h".
 * Arredondar fazia um post recém-criado saltar para um valor que ainda não
 * aconteceu — ler "2 h" num post de 1h05 mina a confiança no resto dos
 * números da tela, que é justamente o que um app de nutrição não pode perder.
 *
 * Acima de uma semana vira data absoluta: "3 sem" não ajuda ninguém a situar
 * o post, e a partir daí a data exata é mais informativa que a distância.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const elapsed = now - Date.parse(iso);

  if (!Number.isFinite(elapsed)) return "";
  // Relógio do cliente atrasado em relação ao servidor produz elapsed negativo.
  // "agora" é a leitura honesta — um rótulo negativo seria pior que impreciso.
  if (elapsed < MINUTE) return "agora";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h`;
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} d`;

  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

export type FeedSection = "hoje" | "ontem" | "semana" | "antes";

/**
 * Em que faixa de recência um post cai.
 *
 * Compara dias de calendário, não janelas de 24h: um post das 23h de ontem
 * visto às 8h de hoje tem 9 horas de idade, mas pertence a "Ontem" — é assim
 * que a pessoa se lembra dele.
 */
export function feedSection(iso: string, now: number = Date.now()): FeedSection {
  const hoje = new Date(now);
  hoje.setHours(0, 0, 0, 0);
  const inicioDeHoje = hoje.getTime();
  const postado = Date.parse(iso);

  if (postado >= inicioDeHoje) return "hoje";
  if (postado >= inicioDeHoje - DAY) return "ontem";
  if (postado >= inicioDeHoje - 7 * DAY) return "semana";
  return "antes";
}

export const SECTION_LABEL: Record<FeedSection, string> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Esta semana",
  antes: "Antes",
};

export type MacroSplit = { protein: number; carbs: number; fat: number };

/**
 * Fatia da energia da refeição que vem de cada macro, somando 1.
 *
 * Proporção de CALORIAS, não de gramas: 19g de gordura e 58g de carboidrato
 * parecem uma diferença de 3x em gramas, mas entregam energia quase igual
 * (171 vs 232 kcal). Dividir por gramas desenharia uma barra que contradiz o
 * número de kcal logo acima dela.
 *
 * Devolve `null` quando não há energia declarada — um post sem macros (raro,
 * mas possível em conquista ou refeição zerada) não deve render uma barra
 * vazia fingindo ser informação.
 */
export function macroEnergySplit(macros: MacroSplit): MacroSplit | null {
  const protein = Math.max(0, macros.protein) * KCAL_PER_G.protein;
  const carbs = Math.max(0, macros.carbs) * KCAL_PER_G.carbs;
  const fat = Math.max(0, macros.fat) * KCAL_PER_G.fat;
  const total = protein + carbs + fat;

  if (total <= 0) return null;
  return { protein: protein / total, carbs: carbs / total, fat: fat / total };
}
