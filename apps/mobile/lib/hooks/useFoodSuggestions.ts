import { useQuery } from "@tanstack/react-query";
import { searchFoods } from "@/lib/api/foods";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";

export function useFoodSuggestions(q: string, enabled: boolean) {
  const trimmed = useDebouncedValue(q.trim(), 250);
  return useQuery({
    queryKey: ["food-suggestions", trimmed],
    queryFn: () => searchFoods(trimmed),
    enabled: enabled && (trimmed === "" || trimmed.length >= 2),
    staleTime: 30_000,
  });
}
