import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { WheelPicker } from "@/components/WheelPicker";
import { shadows } from "@/lib/shadows";

type Props = {
  visible: boolean;
  initialHour: number;
  initialMinute: number;
  onCancel: () => void;
  onConfirm: (hour: number, minute: number) => void;
};

export function TimePicker({ visible, initialHour, initialMinute, onCancel, onConfirm }: Props) {
  const [hour, setHour] = useState(initialHour);
  // Arredonda pra step de 5 minutos no init.
  const [minute, setMinute] = useState(Math.round(initialMinute / 5) * 5);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        className="flex-1 items-center justify-center bg-black/40 px-6"
        accessibilityLabel="Fechar seletor de hora"
      >
        <View
          style={shadows.card}
          className="w-full max-w-sm rounded-2xl bg-white p-4"
          onStartShouldSetResponder={() => true}
        >
          <Text className="mb-3 text-center text-base font-sans-semibold text-neutral-800">
            Horário
          </Text>
          <View className="flex-row items-center justify-center">
            <View className="flex-1">
              <WheelPicker min={0} max={23} value={hour} onChange={setHour} />
            </View>
            <Text className="px-1 text-2xl font-sans-bold text-neutral-700">:</Text>
            <View className="flex-1">
              <WheelPicker min={0} max={55} step={5} value={minute} onChange={setMinute} />
            </View>
          </View>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={onCancel}
              className="min-h-[44px] flex-1 items-center justify-center rounded-xl bg-neutral-100"
              accessibilityLabel="Cancelar"
              accessibilityRole="button"
            >
              <Text className="text-sm font-sans-medium text-neutral-700">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => onConfirm(hour, minute)}
              className="min-h-[44px] flex-1 items-center justify-center rounded-xl bg-primary-500"
              accessibilityLabel="Confirmar"
              accessibilityRole="button"
            >
              <Text className="text-sm font-sans-semibold text-white">Confirmar</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
