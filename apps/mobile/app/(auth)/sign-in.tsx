import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { supabase } from "@/lib/supabase";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.length > 3 && password.length >= 6 && !loading;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
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
            keyboardType="email-address"
            autoComplete="email"
            placeholder="voce@exemplo.com"
          />
          <Input
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
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
    </SafeAreaView>
  );
}
