import { router } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, type TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit = normalizedEmail.length > 3 && password.length >= 6 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 p-5 pt-12">
          <Text className="mb-2 text-3xl font-sans-extrabold text-neutral-800">
            Bem-vindo de volta
          </Text>
          <Text className="mb-8 text-base font-sans text-neutral-600">
            Entre com seu e-mail e senha
          </Text>

          <View className="gap-3">
            <Input
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              placeholder="voce@exemplo.com"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
            />
            <Input
              ref={passwordRef}
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              placeholder="••••••••"
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
              label="Entrar"
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
