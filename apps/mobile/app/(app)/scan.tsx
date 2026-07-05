import { BarcodeScanner } from "@/components/domain/BarcodeScanner";
import { useRouter } from "expo-router";

export default function ScanScreen() {
  const router = useRouter();

  const handleScanned = (barcode: string) => {
    // Navigates to the confirmation screen (T3)
    // We use replace so going back from confirmation doesn't reopen the scanner.
    router.replace({ pathname: "/(app)/scan-confirm" as never, params: { barcode } });
  };

  return <BarcodeScanner onScanned={handleScanned} />;
}
