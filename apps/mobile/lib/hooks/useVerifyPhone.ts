import { useMutation, useQueryClient } from "@tanstack/react-query";
import { verifyPhone } from "@/lib/api/social";

/** Confirma a verificação no backend após o verifyOtp do Supabase. */
export function useVerifyPhone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: verifyPhone,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
