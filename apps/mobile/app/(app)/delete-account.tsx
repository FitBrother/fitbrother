import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AccountCard, AccountScreen } from "@/components/account/AccountScreen";
import { Button } from "@/components/Button";
import { PasswordInput } from "@/components/PasswordInput";
import {
  authorizeDeletionWithPassword,
  completeDeletionOAuth,
  deleteAccount,
  startDeletionOAuth,
} from "@/lib/api/account";
import { authenticateWithOAuth } from "@/lib/oauth";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast/toast-context";

type Provider = "google" | "apple";

export default function DeleteAccountScreen() {
  const router = useRouter();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [authorization, setAuthorization] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setProviders(data.user?.identities?.map((identity) => identity.provider) ?? []);
    });
  }, []);

  async function verifyPassword() {
    setBusy(true);
    setAuthorization(null);
    try {
      const result = await authorizeDeletionWithPassword(password);
      setAuthorization(result.authorization_token);
      setPassword("");
      toast({ variant: "success", message: "Senha confirmada" });
    } catch {
      toast({ variant: "error", message: "Senha incorreta" });
    } finally {
      setBusy(false);
    }
  }

  async function verifyOAuth(provider: Provider) {
    setBusy(true);
    setAuthorization(null);
    try {
      const challenge = await startDeletionOAuth(provider);
      await authenticateWithOAuth(provider);
      const completed = await completeDeletionOAuth(provider, challenge.challenge_token);
      setAuthorization(completed.authorization_token);
      toast({ variant: "success", message: "Identidade confirmada" });
    } catch {
      toast({ variant: "error", message: "Não foi possível confirmar sua identidade" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletion() {
    if (!authorization) return;
    setDeleting(true);
    try {
      await deleteAccount(authorization);
      await supabase.auth.signOut();
      router.replace("/(auth)/welcome");
    } catch (error) {
      setAuthorization(null);
      toast({
        variant: "error",
        message:
          error instanceof Error && error.message === "deletion_authorization_invalid"
            ? "A confirmação expirou. Confirme sua identidade novamente."
            : "Não foi possível excluir a conta",
      });
    } finally {
      setDeleting(false);
    }
  }

  const hasPassword = providers.includes("email");
  return (
    <AccountScreen
      title="Excluir conta"
      subtitle="A exclusão bloqueia sua conta imediatamente. Você poderá reativá-la fazendo login durante 30 dias."
    >
      <AccountCard>
        <Text className="font-sans-semibold text-base text-neutral-900">
          Confirme sua identidade
        </Text>
        {hasPassword || providers.length === 0 ? (
          <View className="mt-4 gap-3">
            <PasswordInput
              label="Senha"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setAuthorization(null);
              }}
              autoComplete="password"
              textContentType="password"
              placeholder="Sua senha"
            />
            <Button
              label="Confirmar senha"
              variant="outline"
              loading={busy}
              disabled={!password}
              onPress={verifyPassword}
            />
          </View>
        ) : null}
        {(["google", "apple"] as const)
          .filter((provider) => providers.includes(provider))
          .map((provider) => (
            <Button
              key={provider}
              className="mt-3"
              label={`Confirmar com ${provider === "google" ? "Google" : "Apple"}`}
              variant="dark"
              loading={busy}
              onPress={() => verifyOAuth(provider)}
            />
          ))}
      </AccountCard>
      <AccountCard>
        <Text className="font-sans-semibold text-base text-danger-600">Confirmação final</Text>
        <Text className="mb-4 mt-1 font-sans text-sm text-neutral-600">
          Seus dados serão apagados definitivamente após 30 dias. Até lá, basta entrar novamente e
          escolher reativar.
        </Text>
        <Button
          label="Excluir minha conta"
          loading={deleting}
          disabled={!authorization}
          onPress={confirmDeletion}
        />
      </AccountCard>
    </AccountScreen>
  );
}
