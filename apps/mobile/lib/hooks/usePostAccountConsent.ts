import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postAccountConsent } from "@/lib/api/account";
import { ACCOUNT_PROFILE_KEY } from "./useAccountProfile";

export function usePostAccountConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postAccountConsent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNT_PROFILE_KEY }),
  });
}
