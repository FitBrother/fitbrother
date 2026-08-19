import { useQuery } from "@tanstack/react-query";
import { getAccountProfile } from "@/lib/api/account";

export const ACCOUNT_PROFILE_KEY = ["account-profile"];

export function useAccountProfile() {
  return useQuery({
    queryKey: ACCOUNT_PROFILE_KEY,
    queryFn: getAccountProfile,
  });
}
