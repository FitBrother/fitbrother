import { useCallback, useRef, useState } from "react";
import { Platform, type TextInput } from "react-native";

/** Altura de uma linha, em px — o piso do input e o valor a que ele volta ao limpar. */
const LINE_HEIGHT = 24;

/**
 * Campo de texto que cresce com o conteúdo, para as barras de composição.
 *
 * Mora num hook, e não dentro de um composer, porque o MealComposer e o
 * CommentComposer precisam do MESMO ajuste — e o do web depende de um detalhe
 * do DOM (abaixo) que ninguém acerta duas vezes por acaso. Duplicado, o próximo
 * a corrigir corrigiria só um dos dois.
 *
 * O `scrollHeight` de uma `<textarea>` nunca lê abaixo do `clientHeight` atual
 * (invariante do DOM), então derivar a altura dele direto faz a catraca subir
 * para sempre a partir de qualquer medição alta acidental — por exemplo, o
 * placeholder quebrando linha enquanto a pilha está momentaneamente estreita.
 * Zerar antes de cada leitura é a correção padrão de textarea auto-crescente:
 * derruba o limite anterior para o `scrollHeight` refletir só o que o conteúdo
 * novo precisa. O `onContentSizeChange` do RN não dá esse controle de
 * zerar-primeiro, daí medir o nó do DOM direto.
 */
export function useAutoGrowInput({ maxHeight = 160 }: { maxHeight?: number } = {}) {
  const ref = useRef<TextInput>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const measure = useCallback(() => {
    if (Platform.OS !== "web") return;
    const node = ref.current as unknown as HTMLTextAreaElement | null;
    if (!node) return;
    // "auto" não seria zero aqui: uma `<textarea>` sem atributo `rows` (o RN Web
    // nunca põe) cai no padrão de 2 linhas do navegador, e "auto" travaria o
    // scrollHeight em 48px mesmo para uma linha curta. "0px" força a medição
    // só do conteúdo.
    node.style.height = "0px";
    const next = Math.min(maxHeight, Math.max(LINE_HEIGHT, node.scrollHeight));
    node.style.height = `${next}px`;
    setContentHeight(next);
  }, [maxHeight]);

  /**
   * Medição depois de digitar.
   *
   * Duas passadas: o valor da `<textarea>` nativa já está atualizado quando
   * isto roda, então a primeira mede na hora e responde instantâneo. Mas ela
   * pode cair no meio de um re-render — o caractere que revela o botão de
   * enviar, por exemplo, também estreita a pilha, e a primeira medição veria a
   * largura antiga. A segunda, depois que o layout assentou, corrige.
   *
   * `setTimeout` e não `rAF`: o rAF não dispara em aba em segundo plano, e isto
   * precisa funcionar de qualquer jeito.
   */
  const measureAfterInput = useCallback(() => {
    measure();
    setTimeout(measure, 0);
  }, [measure]);

  /**
   * Volta ao mínimo de uma linha, para chamar depois de enviar.
   *
   * O nó do DOM ainda mostra o texto pré-limpeza até o React re-renderizar com
   * o valor novo, então não há o que medir — colapsar direto é o certo.
   */
  const reset = useCallback(() => {
    if (Platform.OS === "web") {
      const node = ref.current as unknown as HTMLTextAreaElement | null;
      if (node) node.style.height = `${LINE_HEIGHT}px`;
    }
    setContentHeight(0);
  }, []);

  /** Altura a passar no `style` do TextInput no web. */
  const webHeight = contentHeight || LINE_HEIGHT;

  return { ref, contentHeight, setContentHeight, measure, measureAfterInput, reset, webHeight };
}
