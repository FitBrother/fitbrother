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

export type IosGuideInfo = {
  /** iPad tem a barra do navegador em cima; iPhone/iPod, embaixo. */
  device: "phone" | "pad";
  /** Só Safari e Chrome iOS têm menu suficientemente diferente pra valer um
   * texto próprio — Firefox/Edge/outros caem no genérico "menu do navegador". */
  browser: "safari" | "chrome" | "other";
};

/** Detalhe pro guia visual de "Adicionar à Tela de Início" — só chamar quando `installable-ios`. */
export function iosGuideInfo(): IosGuideInfo {
  if (typeof navigator === "undefined") return { device: "phone", browser: "other" };
  const ua = navigator.userAgent.toLowerCase();
  const device: IosGuideInfo["device"] = /ipad/.test(ua) || isTouchMac(ua) ? "pad" : "phone";
  const browser: IosGuideInfo["browser"] = /crios/.test(ua)
    ? "chrome"
    : /safari/.test(ua) && !/crios|fxios|edgios/.test(ua)
      ? "safari"
      : "other";
  return { device, browser };
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
