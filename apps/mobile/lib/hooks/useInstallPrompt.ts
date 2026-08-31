import { useEffect, useState } from "react";
import { Platform } from "react-native";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __fbInstallPromptEvent?: BeforeInstallPromptEvent | null;
  }
}

type InstallPromptState =
  | { status: "native" }
  | { status: "installed" }
  | { status: "installable-chrome"; promptEvent: BeforeInstallPromptEvent }
  | { status: "installable-ios" }
  | { status: "installable-mac-safari" }
  | { status: "unsupported" };

function isStandalone(): boolean {
  const displayModeStandalone =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return Boolean(displayModeStandalone || iosStandalone);
}

// iPadOS 13+ se anuncia como "Macintosh" por padrão (modo desktop) — só o
// touch de múltiplos pontos denuncia que é um iPad, não um Mac de verdade.
function isTouchMac(ua: string): boolean {
  return (
    /macintosh/.test(ua) &&
    typeof navigator !== "undefined" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1
  );
}

/**
 * Todo navegador em iOS/iPadOS roda sobre o motor WebKit da Apple (é
 * exigência da própria loja) — Chrome, Firefox e Edge no iOS têm o MESMO
 * botão "Adicionar à Tela de Início" dentro do MESMO menu de compartilhar
 * do sistema, não é exclusivo do Safari. Checar só Safari deixava usuário
 * de qualquer outro navegador no iPhone sem instrução nenhuma.
 */
function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || isTouchMac(ua);
}

/**
 * Só o Chrome iOS tem posição confiável o bastante pra valer um texto
 * próprio: "Adicionar à Tela de Início" é item direto do menu (⋯) dele,
 * sem passar por Compartilhar — comportamento fixo do app, não muda com
 * versão/config do usuário.
 *
 * Safari é o oposto: desde o iOS 15 dá pra trocar a barra entre topo e
 * base nos Ajustes, e o ícone de Compartilhar às vezes fica atrás de um
 * menu (⋯ ou ☰) em vez de aparecer direto — não dá pra apostar num layout
 * fixo. Por isso Safari cai no mesmo texto genérico de "other", que já
 * cobre as duas possibilidades no próprio enunciado do passo.
 */
export type IosGuideBrowser = "chrome" | "other";

export function iosGuideBrowser(): IosGuideBrowser {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  return /crios/.test(ua) ? "chrome" : "other";
}

/**
 * Safari no macOS não dispara beforeinstallprompt e não segue o fluxo do
 * iOS (é "Adicionar ao Dock", não "à Tela de Início") — merece um guia
 * próprio em vez de cair em "não suportado".
 */
function isMacSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const isRealMac = /macintosh/.test(ua) && !isTouchMac(ua);
  const isSafariEngine =
    /safari/.test(ua) && !/chrome|chromium|crios|edg|opr|firefox|fxios/.test(ua);
  return isRealMac && isSafariEngine;
}

function initialState(): InstallPromptState {
  if (Platform.OS !== "web") return { status: "native" };
  if (isStandalone()) return { status: "installed" };
  // O Chrome pode ter disparado beforeinstallprompt antes deste hook montar
  // — o listener em public/index.html já capturou e guardou o evento.
  if (typeof window !== "undefined" && window.__fbInstallPromptEvent) {
    return { status: "installable-chrome", promptEvent: window.__fbInstallPromptEvent };
  }
  if (isIosDevice()) return { status: "installable-ios" };
  if (isMacSafari()) return { status: "installable-mac-safari" };
  return { status: "unsupported" };
}

/** Estado do fluxo de "Adicionar à Tela de Início" — no-op fora da web. */
export function useInstallPrompt(): InstallPromptState {
  const [state, setState] = useState<InstallPromptState>(initialState);

  useEffect(() => {
    if (Platform.OS !== "web" || isStandalone()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setState({ status: "installable-chrome", promptEvent: event as BeforeInstallPromptEvent });
    };
    const handleAppInstalled = () => setState({ status: "installed" });

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return state;
}
