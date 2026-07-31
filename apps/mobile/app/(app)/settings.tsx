import * as Localization from "expo-localization";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AccountCard, AccountScreen } from "@/components/account/AccountScreen";
import { Button } from "@/components/Button";
import { WheelPicker } from "@/components/WheelPicker";
import { patchAccountSettings } from "@/lib/api/account";
import { useAccountProfile } from "@/lib/hooks/useAccountProfile";
import { useProfileActions } from "@/lib/profile/profile-context";
import { useToast } from "@/lib/toast/toast-context";

export default function SettingsScreen() {
  const account = useAccountProfile();
  const toast = useToast();
  const { update } = useProfileActions();
  const deviceTimezone = Localization.getCalendars()[0]?.timeZone ?? "UTC";
  const [hour, setHour] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (account.data) setHour(account.data.profile.day_start_hour);
  }, [account.data]);

  async function save(patch: { timezone?: string; day_start_hour?: number }) {
    setSaving(true);
    try {
      const result = await patchAccountSettings(patch);
      update(result.settings);
      await account.refetch();
      toast({ variant: "success", message: "Configurações salvas" });
    } catch {
      toast({ variant: "error", message: "Não foi possível salvar" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <AccountScreen title="Configurações" subtitle="Ajuste como o FitBrother organiza o seu dia.">
      <AccountCard>
        <Text className="font-sans-semibold text-base text-neutral-900">Fuso horário</Text>
        <Text className="mt-1 font-sans text-sm text-neutral-600">
          Salvo: {account.data?.profile.timezone ?? "Carregando…"}
        </Text>
        <Text className="font-sans text-sm text-neutral-600">Neste aparelho: {deviceTimezone}</Text>
        <Button
          className="mt-4"
          label="Usar fuso deste aparelho"
          variant="outline"
          loading={saving}
          disabled={account.data?.profile.timezone === deviceTimezone}
          onPress={() => save({ timezone: deviceTimezone })}
        />
      </AccountCard>
      <AccountCard>
        <Text className="font-sans-semibold text-base text-neutral-900">Início do dia</Text>
        <Text className="mt-1 font-sans text-sm text-neutral-600">
          Refeições antes deste horário contam para o dia anterior.
        </Text>
        <View className="mt-2">
          <WheelPicker min={0} max={23} value={hour} unit="h" onChange={setHour} />
        </View>
        <Button
          label="Salvar início do dia"
          loading={saving}
          disabled={!account.data || hour === account.data.profile.day_start_hour}
          onPress={() => save({ day_start_hour: hour })}
        />
      </AccountCard>
    </AccountScreen>
  );
}
