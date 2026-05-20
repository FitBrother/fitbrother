import { useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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

export function WheelPicker({ min, max, step = 1, value, unit, onChange }: WheelPickerProps) {
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
      listRef.current.scrollToOffset({
        offset: initialIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [initialIndex]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = e.nativeEvent.contentOffset.y;
    const index = Math.round(offset / ITEM_HEIGHT);
    const next = values[index];
    if (next !== undefined && next !== value) onChange(next);
  };

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      style={{ height: PICKER_HEIGHT }}
      className="relative w-full"
    >
      {/* center selection band */}
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
