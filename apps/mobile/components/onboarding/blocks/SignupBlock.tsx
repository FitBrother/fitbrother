import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, type TextInput, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { GoogleIcon } from "@/components/domain/GoogleIcon";
import { Input } from "@/components/Input";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { PasswordInput, passwordStrength } from "@/components/PasswordInput";
import { colors } from "@/lib/colors";
import { friendlyAuthError } from "@/lib/errors";
import { useAuthSession } from "@/lib/hooks/useAuthSession";
import { linkOAuthIdentity, OAuthCallbackError, type OAuthProvider } from "@/lib/oauth";
import { supabase } from "@/lib/supabase";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

// Cheap RFC-5322-adjacent check — a confirmação por e-mail é o validador de verdade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  // E-mail/senha nunca ficam salvos no progresso do onboarding (por segurança),
  // então retomar esse bloco depois de fechar o app sempre volta com os campos
  // em branco — mesmo que a sessão anônima já tenha sido promovida a conta
  // real numa tentativa anterior (updateUser aplicado, app fechado antes de
  // avançar). Detecta esse caso e pula a etapa em vez de pedir e-mail/senha
  // de novo pra uma conta que já existe.
  const authSession = useAuthSession();
  const alreadyUpgraded =
    authSession.status === "signed_in" && authSession.session.user.is_anonymous === false;

  useEffect(() => {
    if (alreadyUpgraded) onNext();
  }, [alreadyUpgraded, onNext]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailExists, setEmailExists] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalizedEmail);
  const passwordValid = passwordStrength(password) >= 2;
  const passwordsMatch = confirmPassword === password;
  const canSubmit = emailValid && passwordValid && passwordsMatch && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setEmailExists(false);
    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
        password,
      });
      if (error) {
        // A sessão anônima já ficou com esse e-mail/senha numa tentativa
        // anterior (app fechado no meio do onboarding, retomado depois no
        // mesmo passo) — não é um erro de verdade, só segue o fluxo.
        if (error.code === "same_password") {
          onNext();
          return;
        }
        // Esse e-mail já é de outra conta (ou virou conta de verdade numa
        // tentativa anterior) — orienta a fazer login em vez de mostrar o
        // erro técnico do Supabase.
        if (error.code === "email_exists") {
          setEmailExists(true);
        }
        setError(friendlyAuthError(error));
        return;
      }
      onNext();
    } catch {
      setError("Não foi possível criar a conta. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setLoading(true);
    setError(null);
    setEmailExists(false);
    try {
      // Vincula à sessão anônima já ativa (não cria sessão nova) — o efeito
      // que detecta is_anonymous:false acima já avança o onboarding sozinho
      // assim que a vinculação for concluída.
      await linkOAuthIdentity(provider);
    } catch (err) {
      if (err instanceof Error && err.message === "oauth_cancelled") return;
      // Mesmo tratamento do e-mail_exists no caminho e-mail/senha: esse
      // e-mail (o da conta Google) já é de outra conta, ou já virou conta de
      // verdade numa tentativa anterior — orienta a fazer login em vez do
      // erro técnico.
      if (
        err instanceof OAuthCallbackError &&
        (err.code === "email_exists" || err.code === "identity_already_exists")
      ) {
        setEmailExists(true);
        setError("Esse e-mail já tem uma conta cadastrada.");
        return;
      }
      setError(
        `Não foi possível continuar com ${provider === "google" ? "Google" : "Apple"}. Tente de novo.`,
      );
    } finally {
      setLoading(false);
    }
  }

  if (authSession.status === "loading" || alreadyUpgraded) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-neutral-50">
        <ActivityIndicator size="large" color={colors.primary[400]} />
      </SafeAreaView>
    );
  }

  return (
    <OnboardingChapterShell
      chapter={chapter}
      title="Crie sua conta"
      subtitle="Pra salvar as metas que você acabou de ver e continuar de onde parou."
      onBack={onBack}
      onNext={handleSubmit}
      nextDisabled={!canSubmit}
    >
      <View className="gap-3">
        <Input
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          onBlur={() => setEmailTouched(true)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          inputMode="email"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="voce@exemplo.com"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          submitBehavior="submit"
          error={emailTouched && !emailValid && email.length > 0 ? "E-mail inválido" : undefined}
        />
        <PasswordInput
          ref={passwordRef}
          label="Senha"
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
          label="Confirmar senha"
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
        {error && (
          <View className="gap-2 rounded-xl border border-danger-600 bg-danger-50 p-3">
            <Text className="text-sm font-sans text-danger-600">{error}</Text>
            {emailExists && (
              <Button
                label="Fazer login"
                variant="ghost"
                size="sm"
                onPress={() => router.push("/(auth)/sign-in")}
              />
            )}
          </View>
        )}

        <View className="flex-row items-center gap-3 py-1">
          <View className="h-px flex-1 bg-neutral-200" />
          <Text className="text-xs font-sans text-neutral-400">ou continue com</Text>
          <View className="h-px flex-1 bg-neutral-200" />
        </View>
        <Button
          label="Continuar com Google"
          variant="outline"
          leftIcon={<GoogleIcon />}
          disabled={loading}
          onPress={() => handleOAuth("google")}
        />
      </View>
    </OnboardingChapterShell>
  );
}
