import { useRef, useState } from "react";
import { type TextInput, Text, View } from "react-native";
import { Input } from "@/components/Input";
import { OnboardingChapterShell } from "@/components/onboarding/OnboardingChapterShell";
import { PasswordInput, passwordStrength } from "@/components/PasswordInput";
import { supabase } from "@/lib/supabase";
import type { OnboardingBlockProps } from "@/lib/onboarding/types";

// Cheap RFC-5322-adjacent check — a confirmação por e-mail é o validador de verdade.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignupBlock({ onNext, onBack, chapter }: OnboardingBlockProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_RE.test(normalizedEmail);
  const passwordValid = passwordStrength(password) >= 2;
  const canSubmit = emailValid && passwordValid && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({
        email: normalizedEmail,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      onNext();
    } catch {
      setError("Não foi possível criar a conta. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
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
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        {error && (
          <View className="rounded-xl border border-danger-600 bg-danger-50 p-3">
            <Text className="text-sm font-sans text-danger-600">{error}</Text>
          </View>
        )}
      </View>
    </OnboardingChapterShell>
  );
}
