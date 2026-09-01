import { Platform } from "react-native";

/**
 * "Puxar pra atualizar" que recarrega o app inteiro, não só os dados de uma
 * tela. Existe pro PWA instalado na tela de início: sem uma barra de
 * navegador pra dar F5, o usuário fica preso na versão de JS que estava
 * aberta quando um deploy novo sai — hoje só sai fechando e reabrindo o app
 * manualmente. Só faz sentido na web (nativo recebe atualização pela loja,
 * não tem "recarregar a página").
 */
export function reloadApp(): void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.reload();
  }
}
