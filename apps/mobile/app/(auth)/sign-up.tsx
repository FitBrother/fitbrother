import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, type TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { PasswordInput, passwordStrength } from "@/components/PasswordInput";
import { supabase } from "@/lib/supabase";

// Cheap RFC-5322-adjacent check — the verification email is the real validator.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalizedEmail);
  // Require strength >= 2 ("Razoável") for sign-up — matches the heuristic.
  const passwordValid = passwordStrength(password) >= 2;
  const canSubmit = emailValid && passwordValid && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/(onboarding)");
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 p-5 pt-12">
          <Text className="mb-2 text-3xl font-sans-extrabold text-neutral-800">Criar conta</Text>
          <Text className="mb-8 text-base font-sans text-neutral-600">
            Comece com e-mail e senha. Configuramos sua dieta nos próximos passos.
          </Text>

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
              error={
                emailTouched && !emailValid && email.length > 0 ? "E-mail inválido" : undefined
              }
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
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {error && (
            <View className="mt-3 rounded-xl border border-danger-600 bg-danger-50 p-3">
              <Text className="text-sm font-sans text-danger-600">{error}</Text>
            </View>
          )}

          <View className="mt-6 gap-3">
            <Button
              label="Continuar"
              variant="primary"
              disabled={!canSubmit}
              loading={loading}
              onPress={handleSubmit}
            />
            <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
