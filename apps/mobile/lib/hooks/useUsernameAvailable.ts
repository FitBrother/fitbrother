import { useQuery } from "@tanstack/react-query";
import { checkUsernameAvailable } from "@/lib/api/users";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function useUsernameAvailable(username: string) {
  const valid = USERNAME_RE.test(username);
  return useQuery({
    queryKey: ["username-available", username],
    queryFn: () => checkUsernameAvailable(username),
    enabled: valid,
    staleTime: 30_000,
  });
}

export { USERNAME_RE };
