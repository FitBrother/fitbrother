import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search } from "lucide-react-native";
import { useRouter } from "expo-router";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { colors } from "@/lib/colors";
import { friendlyAuthError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/Button";
import { PullToRefresh } from "@/components/PullToRefresh";
import { LeaderboardRow } from "@/components/domain/LeaderboardRow";
import { unfollowUser } from "@/lib/api/users";
import { useProfile } from "@/lib/profile/profile-context";
import { followingKey, useFollowing } from "@/lib/hooks/useFollowing";
import { useWeeklyLeaderboard, leaderboardKey } from "@/lib/hooks/useWeeklyLeaderboard";
import { useStreak } from "@/lib/hooks/useStreak";
import { useVerifyPhone } from "@/lib/hooks/useVerifyPhone";
import { useSyncContacts } from "@/lib/hooks/useSyncContacts";

type OtpStep = "idle" | "phone" | "code";

/**
 * Conteúdo de "Amigos" — extraído de app/(app)/friends.tsx pra ser
 * reaproveitado tanto na rota própria (desktop, via Sidebar) quanto embutido
 * na sub-aba "Amigos" dentro do Feed no mobile.
 */
export function FriendsPanel() {
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
      setOtpError(friendlyAuthError(error));
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

  // Escopado de propósito (ao contrário do reload global de Home/Análises/
  // Histórico/Perfil): puxar pra atualizar aqui só recarrega os dados de
  // Amigos, sem levar a página inteira junto.
  function handleRefresh() {
    void following.refetch();
    void leaderboard.refetch();
    void streak.refetch();
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <ScrollView
        contentContainerClassName="px-5 pb-10 gap-5 pt-2"
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={following.isRefetching || leaderboard.isRefetching || streak.isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primary[400]}
          />
        }
      >
        {/* Botão do DS ocupando a largura toda, em vez do link discreto alinhado
          à direita que havia aqui. `outline` e não `primary`: buscar pessoas é
          ação secundária e não deve gritar mais alto que o ranking abaixo. */}
        <Button
          label="Buscar pessoas"
          variant="outline"
          size="sm"
          onPress={() => router.push("/(app)/users/search" as never)}
          accessibilityLabel="Buscar pessoas"
          accessibilityRole="button"
          leftIcon={<Search size={18} color={colors.neutral[800]} />}
        />

        <View className="gap-3">
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
                // 22px pelo mesmo motivo do LeaderboardRow: a linha fecha em
                // ~60px (o botão interno já tem 44, mais o `py-2`), então
                // `rounded-full` daria 30 em vez dos 22 da barra de abas.
                className="min-h-[44px] flex-row items-center justify-between rounded-[22px] border border-neutral-200 bg-white px-3 py-2"
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

        {/* Sincronização de contatos não tem equivalente confiável no navegador
          (sem Contact Picker API cross-browser) — só faz sentido no app nativo. */}
        {Platform.OS !== "web" && (
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
                    <Button
                      label="Confirmar"
                      onPress={confirmCode}
                      loading={verifyPhone.isPending}
                    />
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
        )}
      </ScrollView>
    </PullToRefresh>
  );
}
