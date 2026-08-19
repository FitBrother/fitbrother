import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patchAccountSettings } from "@/lib/api/account";
import { ACCOUNT_PROFILE_KEY } from "./useAccountProfile";

export function usePatchAccountSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchAccountSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ACCOUNT_PROFILE_KEY }),
  });
}
