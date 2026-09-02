import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Pinta a confirmação de vermelho. Para o que apaga ou desfaz algo. */
  destructive?: boolean;
};

export type AlertOptions = {
  title: string;
  description?: string;
  /** Rótulo do único botão. Padrão "Entendi". */
  confirmLabel?: string;
};

type DialogApi = {
  /** Resolve `true` se a pessoa confirmou, `false` se cancelou ou saiu. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Aviso de um botão só. Resolve quando é dispensado. */
  alert: (options: AlertOptions) => Promise<void>;
};

const noop: DialogApi = {
  confirm: async () => false,
  alert: async () => {},
};

const DialogContext = createContext<DialogApi>(noop);

export function useDialog(): DialogApi {
  return useContext(DialogContext);
}

// `Omit` e não interseção: interseção de `string | undefined` com
// `string | null | undefined` dá `string | undefined` — estreita em vez de
// alargar, e o `null` do modo aviso não caberia.
type Pedido = Omit<ConfirmOptions, "cancelLabel"> & { cancelLabel?: string | null };

/**
 * Confirmações e avisos do app, com API imperativa em cima de um componente
 * declarativo.
 *
 * A forma imperativa não é preguiça: `Alert.alert` — o que isto substitui —
 * era chamado de dentro de callbacks de mutação e handlers de gesto, onde não
 * existe render para pendurar um `visible`. Converter cada um desses pontos
 * para estado local significaria uma máquina de estados por tela só para
 * lembrar QUAL confirmação está aberta e o que fazer depois. Com a promessa, a
 * chamada continua lendo como a decisão que ela representa:
 *
 *   if (await confirm({ title: "Excluir refeição?", ... })) remove.mutate(...)
 *
 * Um diálogo por vez, montado na raiz — mesmo desenho do ToastProvider.
 *
 * `Alert.alert` foi abandonado porque no react-native-web ele é literalmente
 * `class Alert { static alert() {} }`. Numa PWA isso não só deixa de avisar:
 * engole a ação junto, porque ela mora no callback de um botão que nunca é
 * desenhado.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  // A promessa é resolvida por um botão que só existe enquanto o diálogo está
  // aberto. Guardar o `resolve` em ref (e não em estado) evita que um render
  // no meio do caminho troque a função por baixo de quem já está esperando.
  const resolverRef = useRef<((confirmado: boolean) => void) | null>(null);

  const fechar = useCallback((confirmado: boolean) => {
    setPedido(null);
    const resolver = resolverRef.current;
    resolverRef.current = null;
    resolver?.(confirmado);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      confirm: (options) =>
        new Promise<boolean>((resolve) => {
          // Uma segunda chamada com um diálogo já aberto resolveria a primeira
          // promessa nunca — quem esperava ficaria pendurado para sempre.
          // Cancelar a anterior é a saída honesta: ela não foi confirmada.
          resolverRef.current?.(false);
          resolverRef.current = resolve;
          setPedido(options);
        }),
      alert: (options) =>
        new Promise<void>((resolve) => {
          resolverRef.current?.(false);
          resolverRef.current = () => resolve();
          setPedido({
            title: options.title,
            description: options.description,
            confirmLabel: options.confirmLabel ?? "Entendi",
            cancelLabel: null,
          });
        }),
    }),
    [],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      <ConfirmDialog
        visible={pedido !== null}
        title={pedido?.title ?? ""}
        description={pedido?.description}
        confirmLabel={pedido?.confirmLabel ?? ""}
        cancelLabel={pedido?.cancelLabel}
        destructive={pedido?.destructive}
        onConfirm={() => fechar(true)}
        onCancel={() => fechar(false)}
      />
    </DialogContext.Provider>
  );
}
