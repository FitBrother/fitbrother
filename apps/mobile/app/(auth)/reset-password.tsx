import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  type TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { LogoHomeLink } from "@/components/LogoHomeLink";
import { PasswordInput, passwordStrength } from "@/components/PasswordInput";
import { colors } from "@/lib/colors";
import { friendlyAuthError } from "@/lib/errors";
import { paramsFromCallbackUrl } from "@/lib/oauth";
import { supabase } from "@/lib/supabase";

type SessionState = "pending" | "ready" | "invalid";

export default function ResetPassword() {
  // Na web, `detectSessionInUrl` (lib/supabase.ts) já troca os tokens do link
  // por uma sessão sozinho, assinalando com o evento PASSWORD_RECOVERY. No
  // nativo não existe esse auto-parse de URL — o link abre o app via deep
  // link e a gente extrai os tokens manualmente do fragment, igual o
  // callback de OAuth em lib/oauth.ts.
  const [sessionState, setSessionState] = useState<SessionState>("pending");
  const url = Linking.useURL();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setSessionState("ready");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Rede de segurança: se nem o listener de PASSWORD_RECOVERY (web) nem o
    // parse manual do deep link (nativo, abaixo) resolverem — link sem
    // tokens, expirado, ou tela aberta sem vir de um link de recuperação —
    // sem isso a tela ficaria presa no spinner pra sempre.
    const timeout = setTimeout(() => {
      setSessionState((prev) => (prev === "pending" ? "invalid" : prev));
    }, 5000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" || !url) return;
    let cancelled = false;
    const params = paramsFromCallbackUrl(new URL(url));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (params.get("type") !== "recovery" || !accessToken || !refreshToken) {
      setSessionState("invalid");
      return;
    }
    void supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (cancelled) return;
        setSessionState(error ? "invalid" : "ready");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const confirmPasswordRef = useRef<TextInput>(null);

  const passwordValid = passwordStrength(password) >= 2;
  const passwordsMatch = confirmPassword === password;
  const canSubmit = passwordValid && passwordsMatch && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    router.replace("/");
  }

  if (sessionState === "pending") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </SafeAreaView>
    );
  }

  if (sessionState === "invalid") {
    return (
      <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
        <View className="w-full flex-1 items-start justify-center p-5 md:mx-auto md:max-w-[440px]">
          <Text className="mb-2 text-3xl font-display-bold text-neutral-800">Link expirado</Text>
          <Text className="mb-8 text-base font-sans text-neutral-600">
            Esse link de redefinição de senha não é mais válido. Peça um novo.
          </Text>
          <Button
            label="Pedir novo link"
            variant="primary"
            className="w-full"
            onPress={() => router.replace("/(auth)/forgot-password")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="w-full flex-1 p-5 pt-12 md:mx-auto md:max-w-[440px]">
          <LogoHomeLink height={28} className="mb-8" />
          <Text className="mb-2 text-3xl font-display-bold text-neutral-800">
            Crie uma nova senha
          </Text>
          <Text className="mb-8 text-base font-sans text-neutral-600">
            Escolha uma senha forte para proteger sua conta.
          </Text>

          <View className="gap-3">
            <PasswordInput
              label="Nova senha"
              value={password}
              onChangeText={setPassword}
              showStrength
              autoComplete="password-new"
              textContentType="newPassword"
              passwordRules="minlength: 8;"
              placeholder="Crie uma senha segura"
              returnKeyType="next"
              onSubmitEditing={() => confirmPasswordRef.current?.focus()}
              submitBehavior="submit"
            />
            <PasswordInput
              ref={confirmPasswordRef}
              label="Confirmar nova senha"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onBlur={() => setConfirmTouched(true)}
              autoComplete="password-new"
              textContentType="newPassword"
              placeholder="Digite a senha de novo"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              error={
                confirmTouched && confirmPassword.length > 0 && !passwordsMatch
                  ? "As senhas não coincidem"
                  : undefined
              }
            />
          </View>

          {error && (
            <View className="mt-3 rounded-xl border border-danger-600 bg-danger-50 p-3">
              <Text className="text-sm font-sans text-danger-600">{error}</Text>
            </View>
          )}

          <View className="mt-6">
            <Button
              label="Salvar nova senha"
              variant="primary"
              disabled={!canSubmit}
              loading={loading}
              onPress={handleSubmit}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
