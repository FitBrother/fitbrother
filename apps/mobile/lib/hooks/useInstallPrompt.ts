import { useEffect, useState } from "react";
import { Platform } from "react-native";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallPromptState =
  | { status: "native" }
  | { status: "installed" }
  | { status: "installable-chrome"; promptEvent: BeforeInstallPromptEvent }
  | { status: "installable-ios" }
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

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios/.test(ua);
  return isIos && !isOtherIosBrowser;
}

/** Estado do fluxo de "Adicionar à Tela de Início" — no-op fora da web. */
export function useInstallPrompt(): InstallPromptState {
  const [state, setState] = useState<InstallPromptState>(() => {
    if (Platform.OS !== "web") return { status: "native" };
    if (isStandalone()) return { status: "installed" };
    if (isIosSafari()) return { status: "installable-ios" };
    return { status: "unsupported" };
  });

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
