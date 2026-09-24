/**
 * A matemática do recorte de foto — pura, sem React e sem DOM.
 *
 * O modelo é o de sempre nesse tipo de editor: a foto preenche um quadro
 * (`cover`), e a pessoa pode aproximar e arrastar dentro dele. O estado é
 * guardado **normalizado**, não em pixels:
 *
 * - `scale` é relativo ao `cover`, então 1 significa "exatamente preenchendo",
 *   qualquer que seja o tamanho da foto ou do quadro.
 * - `dx`/`dy` vão de -1 a 1 e dizem a FRAÇÃO da folga disponível em cada eixo,
 *   não uma distância. Assim o mesmo ajuste vale para o preview encolhido na
 *   tela, para o quadro de captura em tamanho cheio e para o recorte gravado na
 *   imagem final — três tamanhos diferentes do mesmo enquadramento.
 *
 * O efeito colateral bom da fração: no eixo em que não sobra folga (a foto
 * encosta nos dois lados), a folga é zero e o arrasto naquele eixo simplesmente
 * não faz nada, sem precisar de caso especial.
 */

export type Tamanho = { width: number; height: number };

export type Enquadramento = {
  /** Aproximação relativa ao `cover`. 1 = preenchendo, sem sobra. */
  scale: number;
  /** Fração da folga horizontal, de -1 (encostado à direita) a 1 (à esquerda). */
  dx: number;
  /** Fração da folga vertical, de -1 (encostado embaixo) a 1 (em cima). */
  dy: number;
};

export const ENQUADRAMENTO_PADRAO: Enquadramento = { scale: 1, dx: 0, dy: 0 };

/**
 * Teto de aproximação.
 *
 * 4× sobre o `cover` já deixa qualquer foto de celular abaixo da resolução do
 * quadro exportado — aproximar mais só entrega borrão com cara de defeito.
 */
export const ZOOM_MAXIMO = 4;

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Prende o enquadramento aos limites válidos. */
export function limitarEnquadramento(e: Enquadramento): Enquadramento {
  return {
    scale: limitar(e.scale, 1, ZOOM_MAXIMO),
    dx: limitar(e.dx, -1, 1),
    dy: limitar(e.dy, -1, 1),
  };
}

/** Multiplicador que faz a foto cobrir o quadro sem deixar borda. */
export function escalaCover(foto: Tamanho, quadro: Tamanho): number {
  if (foto.width <= 0 || foto.height <= 0) return 1;
  return Math.max(quadro.width / foto.width, quadro.height / foto.height);
}

/** Quanto sobra para arrastar em cada eixo, em pixels do quadro. */
export function folga(foto: Tamanho, quadro: Tamanho, scale: number): { x: number; y: number } {
  const s = escalaCover(foto, quadro) * scale;
  return {
    x: Math.max(0, (foto.width * s - quadro.width) / 2),
    y: Math.max(0, (foto.height * s - quadro.height) / 2),
  };
}

/**
 * O `transform` da foto dentro do quadro: escala absoluta e deslocamento em px.
 *
 * Serve para desenhar — tanto no editor quanto no card.
 */
export function transformarFoto(
  enquadramento: Enquadramento,
  foto: Tamanho,
  quadro: Tamanho,
): { scale: number; x: number; y: number } {
  const e = limitarEnquadramento(enquadramento);
  const f = folga(foto, quadro, e.scale);
  return {
    scale: escalaCover(foto, quadro) * e.scale,
    x: e.dx * f.x,
    y: e.dy * f.y,
  };
}

/**
 * O retângulo da foto ORIGINAL que o quadro está mostrando, em pixels da foto.
 *
 * É o que grava o recorte: o enquadramento deixa de ser um ajuste de exibição e
 * vira a imagem em si. Sempre cai dentro da foto — é o `cover` mais o limite do
 * arrasto que garantem isso, e o `Math.min`/`Math.max` no fim cobre o
 * arredondamento.
 */
export function retanguloDeCorte(
  enquadramento: Enquadramento,
  foto: Tamanho,
  quadro: Tamanho,
): { originX: number; originY: number; width: number; height: number } {
  const t = transformarFoto(enquadramento, foto, quadro);
  // Canto superior esquerdo da foto desenhada, em coordenadas do quadro: ela é
  // centrada e depois deslocada.
  const esquerda = (quadro.width - foto.width * t.scale) / 2 + t.x;
  const topo = (quadro.height - foto.height * t.scale) / 2 + t.y;

  const largura = Math.min(foto.width, quadro.width / t.scale);
  const altura = Math.min(foto.height, quadro.height / t.scale);
  return {
    originX: limitar(-esquerda / t.scale, 0, foto.width - largura),
    originY: limitar(-topo / t.scale, 0, foto.height - altura),
    width: largura,
    height: altura,
  };
}

/**
 * Converte um arrasto em pixels do quadro para incremento de `dx`/`dy`.
 *
 * Fica aqui, e não no gesto, porque depende da folga — que depende do zoom.
 * Sem folga num eixo, o arrasto naquele eixo é zero e não há divisão por zero.
 */
export function arrastoParaFracao(
  deslocamento: { x: number; y: number },
  foto: Tamanho,
  quadro: Tamanho,
  scale: number,
): { dx: number; dy: number } {
  const f = folga(foto, quadro, scale);
  return {
    dx: f.x > 0 ? deslocamento.x / f.x : 0,
    dy: f.y > 0 ? deslocamento.y / f.y : 0,
  };
}
