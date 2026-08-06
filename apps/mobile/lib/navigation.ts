import type { Router } from "expo-router";

type BackRouter = Pick<Router, "back" | "canGoBack" | "replace">;

export function backOrHome(router: BackRouter): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(app)");
}
