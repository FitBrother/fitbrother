import { useQuery } from "@tanstack/react-query";
import { lookupBarcodeProduct } from "@/lib/api/barcode";

export function useBarcodeProduct(barcode: string | undefined) {
  return useQuery({
    queryKey: ["barcode", barcode],
    queryFn: () => {
      if (!barcode) throw new Error("No barcode");
      return lookupBarcodeProduct(barcode);
    },
    enabled: !!barcode,
    staleTime: Infinity, // barcodes don't change often
    retry: (failureCount, error) => {
      if (error.message === "product_not_found") return false;
      return failureCount < 2;
    },
  });
}
