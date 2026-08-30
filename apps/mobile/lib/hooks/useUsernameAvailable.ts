import { useQuery } from "@tanstack/react-query";
import { checkUsernameAvailable } from "@/lib/api/users";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

export function useUsernameAvailable(username: string) {
  // Debounced pra não disparar uma request por tecla digitada — só verifica
  // depois que o usuário para de digitar por 400ms.
  const debounced = useDebouncedValue(username, 400);
  const valid = USERNAME_RE.test(debounced);
  return useQuery({
    queryKey: ["username-available", debounced],
    queryFn: () => checkUsernameAvailable(debounced),
    enabled: valid,
    staleTime: 30_000,
  });
}

export { USERNAME_RE };
