import { useLocalSearchParams, useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { ChevronLeft, Save, TriangleAlert } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErrorBanner, type ErrorBannerVariant } from "@/components/domain/ErrorBanner";
import { colors } from "@/lib/colors";
import { useBarcodeProduct } from "@/lib/hooks/useBarcodeProduct";
import { useCreateMealBarcode } from "@/lib/hooks/useCreateMealBarcode";
import { newClientMealId, useCreateMealText } from "@/lib/hooks/useCreateMealText";
import { shadows } from "@/lib/shadows";
import { nutritionalToday } from "@/lib/time/nutritional-day";
import { useProfile } from "@/lib/profile/profile-context";
import type { MealResponse } from "@fitbrother/shared";

type MealType = MealResponse["meal_type"];
const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Café" },
  { id: "lunch", label: "Almoço" },
  { id: "snack", label: "Lanche" },
  { id: "dinner", label: "Jantar" },
  { id: "other", label: "Outro" },
];

function inferMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 18 && hour < 23) return "dinner";
  return "snack";
}

export default function ScanConfirmScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useProfile();

  const { data: product, isLoading, error } = useBarcodeProduct(barcode);
  const createMeal = useCreateMealBarcode();
  const createMealText = useCreateMealText();

  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState<"g" | "ml" | "unit">("g");
  const [mealType, setMealType] = useState<MealType>(inferMealType());
  const [banner, setBanner] = useState<ErrorBannerVariant | null>(null);
  const isNotFound = error?.message === "product_not_found";
  const sentToAiRef = useRef(false);

  const handleSave = () => {
    if (!product || !barcode) return;
    const q = Number(quantity.replace(",", "."));
    if (isNaN(q) || q <= 0) return;

    setBanner(null);
    createMeal.mutate(
      {
        client_meal_id: newClientMealId(),
        barcode,
        quantity: q,
        unit,
        meal_type: mealType,
        day: nutritionalToday(profile),
      },
      {
        onSuccess: () => {
          router.replace("/(app)/" as never);
        },
        onError: () => {
          setBanner("network");
        },
      },
    );
  };

  const handleSendToAI = useCallback(() => {
    if (!barcode) return;
    setBanner(null);
    createMealText.mutate(
      {
        client_meal_id: newClientMealId(),
        text: `Código de barras: ${barcode}`,
        locale: Localization.getLocales()[0]?.languageTag ?? "pt-BR",
        day: nutritionalToday(profile),
      },
      {
        onSuccess: () => {
          router.replace("/(app)/" as never);
        },
        onError: () => {
          setBanner("network");
        },
      },
    );
  }, [barcode, createMealText, profile, router]);

  useEffect(() => {
    if (isNotFound && !sentToAiRef.current) {
      sentToAiRef.current = true;
      handleSendToAI();
    }
  }, [handleSendToAI, isNotFound]);

  // Pre-fill quantity based on serving_g if available, once the product loads.
  useEffect(() => {
    if (product?.serving_g && unit === "g" && quantity === "100") {
      setQuantity(String(product.serving_g));
    }
  }, [product, quantity, unit]);

  const qNum = Number(quantity.replace(",", ".")) || 0;
  let factor = 1;
  if (unit === "g" || unit === "ml") factor = qNum / 100;
  else if (unit === "unit" && product?.serving_g) factor = (qNum * product.serving_g) / 100;

  const derived = {
    kcal: Math.round((product?.kcal_per_100g || 0) * factor * 100) / 100,
    protein: Math.round((product?.protein_per_100g || 0) * factor * 100) / 100,
    carbs: Math.round((product?.carbs_per_100g || 0) * factor * 100) / 100,
    fat: Math.round((product?.fat_per_100g || 0) * factor * 100) / 100,
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-neutral-50 justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary[400]} />
        <Text className="mt-4 text-neutral-500 font-sans">Buscando produto...</Text>
      </View>
    );
  }

  if (isNotFound || createMealText.isPending) {
    return (
      <View className="flex-1 bg-neutral-50 justify-center items-center">
        <ActivityIndicator size="large" color={colors.primary[400]} />
        <Text className="mt-4 text-neutral-500 font-sans text-center px-6">
          Não achamos esse código de barras na base. Deixa com a IA...
        </Text>
      </View>
    );
  }

  if (!product) return null;

  return (
    <View className="flex-1 bg-neutral-50 md:mx-auto md:w-full md:max-w-[640px]">
      <View
        style={{ paddingTop: insets.top }}
        className="px-4 pb-2 flex-row items-center border-b border-neutral-200 bg-white"
      >
        <Pressable onPress={() => router.back()} className="p-2 -ml-2" hitSlop={16}>
          <ChevronLeft size={24} color={colors.neutral[800]} />
        </Pressable>
        <Text className="flex-1 text-center font-sans-semibold text-lg text-neutral-800 mr-8">
          Confirmar Produto
        </Text>
      </View>

      {banner && <ErrorBanner variant={banner} onDismiss={() => setBanner(null)} />}

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {!product.macros_complete && (
          <View className="bg-warning-50 border border-warning-200 rounded-2xl p-4 flex-row gap-3 mb-6">
            <TriangleAlert size={20} color={colors.warning[500]} className="mt-0.5" />
            <Text className="flex-1 text-warning-800 font-sans">
              Dados nutricionais incompletos. Este item será marcado para revisão e você poderá
              editá-lo depois.
            </Text>
          </View>
        )}

        <View style={shadows.card} className="bg-white rounded-3xl p-5 mb-6">
          <View className="flex-row items-center gap-4 mb-4">
            {product.image_url ? (
              <Image
                source={{ uri: product.image_url }}
                className="w-16 h-16 rounded-xl bg-neutral-100"
                resizeMode="contain"
              />
            ) : (
              <View className="w-16 h-16 rounded-xl bg-neutral-100 items-center justify-center">
                <Text className="text-neutral-400 font-sans-medium">Sem foto</Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-lg font-sans-semibold text-neutral-800" numberOfLines={2}>
                {product.name}
              </Text>
              {product.brand && (
                <Text className="text-sm font-sans text-neutral-500 mt-1">{product.brand}</Text>
              )}
            </View>
          </View>

          <View className="flex-row items-end gap-3 mt-4 pt-4 border-t border-neutral-100">
            <View className="flex-1">
              <Text className="text-sm font-sans-medium text-neutral-500 mb-1.5 ml-1">
                Quantidade
              </Text>
              <TextInput
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                className="bg-neutral-100 rounded-2xl px-4 py-3 font-sans-medium text-neutral-800 text-base"
                style={{ fontVariant: ["tabular-nums"] }}
              />
            </View>
            <View className="flex-row bg-neutral-100 rounded-2xl overflow-hidden h-[48px]">
              <Pressable
                onPress={() => setUnit("g")}
                className={["px-4 justify-center", unit === "g" ? "bg-primary-50" : ""].join(" ")}
              >
                <Text
                  className={[
                    "font-sans-medium",
                    unit === "g" ? "text-primary-600" : "text-neutral-500",
                  ].join(" ")}
                >
                  g
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setUnit("ml")}
                className={[
                  "px-4 justify-center border-l border-neutral-200",
                  unit === "ml" ? "bg-primary-50" : "",
                ].join(" ")}
              >
                <Text
                  className={[
                    "font-sans-medium",
                    unit === "ml" ? "text-primary-600" : "text-neutral-500",
                  ].join(" ")}
                >
                  ml
                </Text>
              </Pressable>
              {product.serving_g && (
                <Pressable
                  onPress={() => setUnit("unit")}
                  className={[
                    "px-4 justify-center border-l border-neutral-200",
                    unit === "unit" ? "bg-primary-50" : "",
                  ].join(" ")}
                >
                  <Text
                    className={[
                      "font-sans-medium",
                      unit === "unit" ? "text-primary-600" : "text-neutral-500",
                    ].join(" ")}
                  >
                    porção
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        <View style={shadows.card} className="bg-white rounded-3xl p-5 mb-6">
          <Text className="text-base font-sans-semibold text-neutral-800 mb-4">
            Macros Estimados
          </Text>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-sans text-neutral-500">Calorias</Text>
            <Text
              className="font-sans-semibold text-neutral-800"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {product.kcal_per_100g === null ? "—" : `${derived.kcal} kcal`}
            </Text>
          </View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-sans text-neutral-500">Proteína</Text>
            <Text
              className="font-sans-medium text-neutral-700"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {product.protein_per_100g === null ? "—" : `${derived.protein} g`}
            </Text>
          </View>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="font-sans text-neutral-500">Carboidratos</Text>
            <Text
              className="font-sans-medium text-neutral-700"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {product.carbs_per_100g === null ? "—" : `${derived.carbs} g`}
            </Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="font-sans text-neutral-500">Gordura</Text>
            <Text
              className="font-sans-medium text-neutral-700"
              style={{ fontVariant: ["tabular-nums"] }}
            >
              {product.fat_per_100g === null ? "—" : `${derived.fat} g`}
            </Text>
          </View>
        </View>

        <View style={shadows.card} className="bg-white rounded-3xl p-5 mb-8">
          <Text className="text-sm font-sans-medium text-neutral-500 mb-3 ml-1">
            Tipo de Refeição
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {MEAL_TYPES.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setMealType(t.id)}
                className={[
                  "px-4 py-2 rounded-full border",
                  mealType === t.id
                    ? "bg-primary-50 border-primary-200"
                    : "bg-white border-neutral-200",
                ].join(" ")}
              >
                <Text
                  className={[
                    "font-sans-medium",
                    mealType === t.id ? "text-primary-700" : "text-neutral-600",
                  ].join(" ")}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[shadows.floating, { paddingBottom: Math.max(insets.bottom, 16) }]}
        className="bg-white px-4 pt-4 border-t border-neutral-100"
      >
        <Pressable
          onPress={handleSave}
          disabled={createMeal.isPending}
          className="bg-primary-400 active:bg-primary-500 rounded-full flex-row justify-center items-center py-4"
        >
          {createMeal.isPending ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Save size={20} color="white" />
              <Text className="text-white font-sans-semibold text-lg ml-2">Salvar Refeição</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
