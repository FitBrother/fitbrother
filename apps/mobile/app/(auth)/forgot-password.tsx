import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { LogoHomeLink } from "@/components/LogoHomeLink";
import { friendlyAuthError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalizedEmail);
  const canSubmit = emailValid && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: Linking.createURL("reset-password"),
    });
    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error));
      return;
    }
    // Nunca confirmar aqui se o e-mail existe de fato — daria pra enumerar
    // contas cadastradas testando e-mails um a um. A mensagem de sucesso é a
    // mesma esteja ou não o e-mail cadastrado; o GoTrue já se comporta assim
    // (200 OK em ambos os casos).
    setSent(true);
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="w-full flex-1 p-5 pt-12 md:mx-auto md:max-w-[440px]">
          <LogoHomeLink height={28} className="mb-8" />

          {sent ? (
            <>
              <Text className="mb-2 text-3xl font-display-bold text-neutral-800">
                Verifique seu e-mail
              </Text>
              <Text className="mb-8 text-base font-sans text-neutral-600">
                Se {normalizedEmail} tiver uma conta, enviamos um link para redefinir a senha.
              </Text>
              <Button
                label="Voltar para o login"
                variant="outline"
                onPress={() => router.replace("/(auth)/sign-in")}
              />
            </>
          ) : (
            <>
              <Text className="mb-2 text-3xl font-display-bold text-neutral-800">
                Esqueceu sua senha?
              </Text>
              <Text className="mb-8 text-base font-sans text-neutral-600">
                Informe seu e-mail e enviaremos um link para você criar uma nova senha.
              </Text>

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
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                error={
                  emailTouched && !emailValid && email.length > 0 ? "E-mail inválido" : undefined
                }
              />

              {error && (
                <View className="mt-3 rounded-xl border border-danger-600 bg-danger-50 p-3">
                  <Text className="text-sm font-sans text-danger-600">{error}</Text>
                </View>
              )}

              <View className="mt-6 gap-3">
                <Button
                  label="Enviar link"
                  variant="primary"
                  disabled={!canSubmit}
                  loading={loading}
                  onPress={handleSubmit}
                />
                <Button
                  label="Voltar para o login"
                  variant="ghost"
                  disabled={loading}
                  onPress={() => router.replace("/(auth)/sign-in")}
                />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
