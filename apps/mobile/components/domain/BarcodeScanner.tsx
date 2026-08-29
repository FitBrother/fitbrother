import { useState, useCallback, useRef } from "react";
import { StyleSheet, View, Text, Pressable, Linking, Platform, TextInput } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { X, Flashlight, FlashlightOff } from "lucide-react-native";
import { colors } from "@/lib/colors";
import { shadows } from "@/lib/shadows";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  onScanned: (barcode: string) => void;
};

export function BarcodeScanner({ onScanned }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [mockBarcode, setMockBarcode] = useState("");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scannedRef = useRef(false);

  // O shim web do expo-camera só detecta QR, não EAN13/EAN8/UPC (o que este
  // scanner precisa) — reaproveita o mesmo fallback manual do Expo Go.
  const useManualFallback = Constants.appOwnership === "expo" || Platform.OS === "web";

  const handleScan = useCallback(
    (result: { data: string }) => {
      if (scannedRef.current) return;
      scannedRef.current = true;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      onScanned(result.data);
    },
    [onScanned],
  );

  const handleSimulate = () => {
    if (!mockBarcode.trim()) return;
    onScanned(mockBarcode.trim());
  };

  if (useManualFallback) {
    return (
      <View
        style={{ paddingTop: Math.max(insets.top, 20) }}
        className="flex-1 bg-neutral-900 px-6 justify-center"
      >
        <Text className="text-white text-xl font-sans-semibold text-center mb-2">
          {Platform.OS === "web" ? "Digite o código de barras" : "Modo de Simulação (Expo Go)"}
        </Text>
        <Text className="text-neutral-400 text-sm font-sans text-center mb-6">
          {Platform.OS === "web"
            ? "A leitura de código de barras não está disponível no navegador. Digite ou cole o código do produto:"
            : "Como o Expo Go não suporta a câmera nativa deste projeto, digite ou cole um código de barras de um produto real para testar o fluxo:"}
        </Text>

        <TextInput
          placeholder="Ex: 7891000123456"
          placeholderTextColor={colors.neutral[400]}
          value={mockBarcode}
          onChangeText={setMockBarcode}
          keyboardType="numeric"
          className="bg-neutral-800 text-white rounded-2xl px-4 py-4 font-sans text-lg text-center mb-4 border border-neutral-700"
        />

        <Pressable
          onPress={handleSimulate}
          className="bg-primary-500 py-4 rounded-full items-center active:bg-primary-600"
        >
          <Text className="text-white font-sans-semibold text-base">Simular Escaneamento</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} className="mt-6 p-2 items-center">
          <Text className="text-neutral-500 font-sans">Voltar</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) {
    return <View className="flex-1 bg-black" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-neutral-900 justify-center items-center px-6">
        <Text className="text-white text-lg font-sans-medium text-center mb-6">
          Precisamos de acesso à câmera para escanear o código de barras.
        </Text>
        <Pressable
          onPress={() => {
            if (permission.canAskAgain) requestPermission();
            else Linking.openSettings();
          }}
          className="bg-primary-500 py-3 px-6 rounded-full"
        >
          <Text className="text-white font-sans-semibold">Permitir Câmera</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="mt-4 p-2">
          <Text className="text-neutral-400 font-sans">Voltar</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"],
        }}
        onBarcodeScanned={handleScan}
      />

      {/* Overlay Header */}
      <View
        style={{ paddingTop: Math.max(insets.top, 20) }}
        className="px-4 flex-row justify-between items-center z-10"
      >
        <Pressable
          onPress={() => router.back()}
          style={shadows.floating}
          className="h-12 w-12 bg-black/40 rounded-full items-center justify-center"
        >
          <X size={24} color={colors.white} />
        </Pressable>
        <Pressable
          onPress={() => setTorch(!torch)}
          style={shadows.floating}
          className="h-12 w-12 bg-black/40 rounded-full items-center justify-center"
        >
          {torch ? (
            <Flashlight size={24} color={colors.white} />
          ) : (
            <FlashlightOff size={24} color={colors.white} />
          )}
        </Pressable>
      </View>

      {/* Viewfinder */}
      <View className="flex-1 justify-center items-center pointer-events-none z-10">
        <View className="w-64 h-48 border-2 border-white/50 rounded-2xl overflow-hidden relative">
          <View className="absolute top-1/2 left-0 right-0 h-0.5 bg-primary-400 shadow-md" />
        </View>
        <Text
          style={{
            textShadowColor: "rgba(0, 0, 0, 0.75)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          className="text-white mt-6 font-sans-medium text-base"
        >
          Aponte para o código de barras
        </Text>
      </View>
    </View>
  );
}
