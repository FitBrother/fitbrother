import { useQuery } from "@tanstack/react-query";
import { getAccountProfile } from "@/lib/api/account";

export const accountProfileKey = ["account", "profile"] as const;

export function useAccountProfile() {
  return useQuery({ queryKey: accountProfileKey, queryFn: getAccountProfile });
}
