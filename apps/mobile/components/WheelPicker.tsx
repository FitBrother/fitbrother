import { Minus, Plus } from "lucide-react-native";
import { useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const PADDING_ITEMS = Math.floor(VISIBLE_ITEMS / 2);

interface WheelPickerProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function WheelPicker(props: WheelPickerProps) {
  // FlatList snap-scrolling doesn't translate well to react-native-web; the
  // user can't drag the wheel with a mouse. Swap to a simple stepper on web.
  if (Platform.OS === "web") {
    return <WebStepper {...props} />;
  }
  return <NativeWheel {...props} />;
}

function WebStepper({ min, max, step = 1, value, unit, onChange }: WheelPickerProps) {
  const decimals = step < 1 ? Math.min(2, String(step).split(".")[1]?.length ?? 0) : 0;
  const format = (n: number) => n.toFixed(decimals);

  const clamp = (n: number) => Math.max(min, Math.min(max, Number(n.toFixed(decimals))));
  const dec = () => onChange(clamp(value - step));
  const inc = () => onChange(clamp(value + step));

  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ text: unit ? `${format(value)} ${unit}` : format(value) }}
      className="w-full flex-row items-center justify-center gap-6"
      style={{ height: PICKER_HEIGHT }}
    >
      <StepButton onPress={dec} disabled={atMin} icon="minus" label="Diminuir" />
      <View className="min-w-[160px] items-center justify-center">
        <Text
          className="text-4xl font-sans-extrabold text-neutral-900"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {format(value)}
        </Text>
        {unit && <Text className="mt-1 text-sm font-sans-medium text-neutral-500">{unit}</Text>}
      </View>
      <StepButton onPress={inc} disabled={atMax} icon="plus" label="Aumentar" />
    </View>
  );
}

function StepButton({
  onPress,
  disabled,
  icon,
  label,
}: {
  onPress: () => void;
  disabled: boolean;
  icon: "minus" | "plus";
  label: string;
}) {
  const Icon = icon === "minus" ? Minus : Plus;
  const bg = disabled ? "bg-neutral-200" : "bg-neutral-900";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className={`h-12 w-12 items-center justify-center rounded-full active:bg-neutral-700 ${bg}`}
    >
      <Icon size={20} color="#ffffff" />
    </Pressable>
  );
}

function NativeWheel({ min, max, step = 1, value, unit, onChange }: WheelPickerProps) {
  const values = useMemo(() => {
    const out: number[] = [];
    for (let v = min; v <= max; v += step) out.push(Number(v.toFixed(2)));
    return out;
  }, [min, max, step]);

  const listRef = useRef<FlatList<number>>(null);
  const initialIndex = Math.max(
    0,
    values.findIndex((v) => v === value),
  );

  useEffect(() => {
    if (initialIndex >= 0 && listRef.current) {
      listRef.current.scrollToOffset({ offset: initialIndex * ITEM_HEIGHT, animated: false });
    }
  }, [initialIndex]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ITEM_HEIGHT);
    const next = values[index];
    if (next !== undefined && next !== value) onChange(next);
  };

  // accessibilityValue.now requires an integer on iOS — `text` carries the
  // human-readable form so decimals (e.g. 87.5 kg) don't crash the bridge.
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ text: unit ? `${value} ${unit}` : String(value) }}
      style={{ height: PICKER_HEIGHT }}
      className="relative w-full"
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: PADDING_ITEMS * ITEM_HEIGHT,
          height: ITEM_HEIGHT,
          left: 0,
          right: 0,
        }}
        className="border-y border-neutral-200"
      />
      <FlatList
        ref={listRef}
        data={values}
        keyExtractor={(v) => String(v)}
        renderItem={({ item }) => {
          const isSelected = item === value;
          return (
            <View style={{ height: ITEM_HEIGHT }} className="items-center justify-center">
              <Text
                className={[
                  "text-2xl",
                  isSelected ? "font-sans-semibold text-neutral-900" : "font-sans text-neutral-400",
                ].join(" ")}
                style={{ fontVariant: ["tabular-nums"] }}
              >
                {item}
                {unit && isSelected ? ` ${unit}` : ""}
              </Text>
            </View>
          );
        }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{ paddingVertical: PADDING_ITEMS * ITEM_HEIGHT }}
      />
    </View>
  );
}
