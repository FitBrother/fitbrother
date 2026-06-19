import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { colors } from "@/lib/colors";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/Button";
import { LeaderboardRow } from "@/components/domain/LeaderboardRow";
import { unfollowUser } from "@/lib/api/users";
import { useProfile } from "@/lib/profile/profile-context";
import { followingKey, useFollowing } from "@/lib/hooks/useFollowing";
import { useWeeklyLeaderboard } from "@/lib/hooks/useWeeklyLeaderboard";
import { leaderboardKey } from "@/lib/hooks/useWeeklyLeaderboard";
import { useStreak } from "@/lib/hooks/useStreak";
import { useVerifyPhone } from "@/lib/hooks/useVerifyPhone";
import { useSyncContacts } from "@/lib/hooks/useSyncContacts";

type OtpStep = "idle" | "phone" | "code";

export default function FriendsScreen() {
  const router = useRouter();
  const profile = useProfile();
  const following = useFollowing();
  const leaderboard = useWeeklyLeaderboard();
  const streak = useStreak();
  const verifyPhone = useVerifyPhone();
  const syncContacts = useSyncContacts();
  const qc = useQueryClient();

  const unfollow = useMutation({
    mutationFn: (userId: string) => unfollowUser(userId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: followingKey, refetchType: "all" }),
        qc.invalidateQueries({ queryKey: leaderboardKey, refetchType: "all" }),
      ]);
    },
  });

  const [otpStep, setOtpStep] = useState<OtpStep>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  // Fonte da verdade é o profile; otpJustVerified cobre a janela entre confirmar
  // o OTP e o /me revalidar.
  const [otpJustVerified, setOtpJustVerified] = useState(false);
  const isVerified = Boolean(profile.phone_verified_at) || otpJustVerified;

  async function sendCode() {
    setOtpError(null);
    const parsed = parsePhoneNumberFromString(phone, "BR");
    if (!parsed?.isValid()) {
      setOtpError("Número inválido. Use DDD + número.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ phone: parsed.number });
    if (error) {
      setOtpError(error.message);
      return;
    }
    setPhone(parsed.number);
    setOtpStep("code");
  }

  async function confirmCode() {
    setOtpError(null);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
    if (error) {
      setOtpError("Código inválido ou expirado.");
      return;
    }
    try {
      await verifyPhone.mutateAsync();
      setOtpJustVerified(true);
      setOtpStep("idle");
    } catch {
      setOtpError("Não foi possível confirmar a verificação.");
    }
  }

  async function onSync() {
    try {
      const followed = await syncContacts.mutateAsync();
      Alert.alert("Pronto!", `${followed.length} contato(s) já usam o Fitbrother.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "erro";
      Alert.alert(
        "Não rolou",
        msg === "contacts_permission_denied" ? "Permita o acesso aos contatos." : "Tente de novo.",
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          className="min-h-[44px] min-w-[44px] items-center justify-center"
        >
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="ml-2 text-xl font-sans-bold text-neutral-800">Amigos</Text>
      </View>

      <ScrollView contentContainerClassName="px-5 pb-10 gap-5">
        <View className="gap-3 pt-4">
          <Text className="font-sans-bold text-base text-neutral-800">Ranking semanal</Text>
          {leaderboard.isLoading ? (
            <ActivityIndicator color={colors.primary[400]} />
          ) : (
            (leaderboard.data ?? []).map((row, i) => (
              <LeaderboardRow
                key={row.user_id}
                position={i + 1}
                fullName={row.full_name}
                // Weekly leaderboard is capped to a 7-day window. For "Você",
                // show the full streak value so it matches Home expectations.
                windowStreak={
                  row.is_me && streak.data ? streak.data.streak.current_streak : row.window_streak
                }
                weeklyHits={row.weekly_hits}
                isMe={row.is_me}
              />
            ))
          )}
        </View>

        <View className="gap-2">
          <Text className="font-sans-bold text-base text-neutral-800">
            Seguindo ({following.data?.length ?? 0})
          </Text>
          {following.isLoading ? (
            <ActivityIndicator color={colors.primary[400]} />
          ) : (following.data ?? []).length > 0 ? (
            (following.data ?? []).map((f) => (
              <View
                key={f.user_id}
                className="min-h-[44px] flex-row items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 py-2"
              >
                <Text className="flex-1 pr-3 font-sans text-sm text-neutral-700">
                  {f.full_name ?? "Amigo"}
                </Text>
                <Pressable
                  onPress={() => unfollow.mutate(f.user_id)}
                  disabled={unfollow.isPending && unfollow.variables === f.user_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Deixar de seguir ${f.full_name ?? "amigo"}`}
                  className="min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-neutral-200 bg-white px-3"
                >
                  <Text className="font-sans-semibold text-sm text-neutral-700">
                    {unfollow.isPending && unfollow.variables === f.user_id
                      ? "..."
                      : "Deixar de seguir"}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text className="font-sans text-sm text-neutral-500">
              Você ainda não segue ninguém. Use a busca para encontrar pessoas.
            </Text>
          )}
        </View>

        <View className="mt-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
          <Text className="font-sans-bold text-base text-neutral-800">Conectar contatos</Text>
          <Text className="font-sans text-sm text-neutral-500">
            A busca por username funciona sem telefone. Verificar o WhatsApp só ajuda a encontrar
            contatos automaticamente.
          </Text>
          {!isVerified ? (
            <>
              {otpStep === "idle" && (
                <>
                  <Button label="Verificar telefone" onPress={() => setOtpStep("phone")} />
                </>
              )}
              {otpStep === "phone" && (
                <>
                  <Text className="font-sans-medium text-sm text-neutral-700">Seu telefone</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="(11) 99999-9999"
                    keyboardType="phone-pad"
                    className="rounded-2xl border border-neutral-200 bg-white p-4 font-sans text-base"
                  />
                  {otpError && (
                    <Text className="font-sans text-sm text-danger-500">{otpError}</Text>
                  )}
                  <Button label="Enviar código" onPress={sendCode} />
                </>
              )}
              {otpStep === "code" && (
                <>
                  <Text className="font-sans-medium text-sm text-neutral-700">
                    Código enviado para {phone}
                  </Text>
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    className="rounded-2xl border border-neutral-200 bg-white p-4 text-center font-sans-bold text-2xl"
                    style={{ fontVariant: ["tabular-nums"] }}
                  />
                  {otpError && (
                    <Text className="font-sans text-sm text-danger-500">{otpError}</Text>
                  )}
                  <Button label="Confirmar" onPress={confirmCode} loading={verifyPhone.isPending} />
                  <Pressable
                    onPress={() => setOtpStep("phone")}
                    className="min-h-[44px] justify-center"
                  >
                    <Text className="font-sans text-sm text-neutral-500">
                      Reenviar / trocar número
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <>
              <Button
                label={syncContacts.isPending ? "Sincronizando..." : "Conectar contatos"}
                onPress={onSync}
                loading={syncContacts.isPending}
                disabled={syncContacts.isPending}
              />
              <Text className="font-sans text-xs text-neutral-400">
                Só enviamos os números de forma criptografada (hash). Nunca em texto.
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
