// apps/mobile/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

// Single instance shared across the app. RN doesn't have window-focus events
// in the web sense — React Query handles AppState transitions internally when
// `refetchOnWindowFocus` is true (default).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      // Meal POSTs must not auto-retry — would create duplicates from the
      // user's perspective even when client_meal_id deduplicates server-side.
      retry: 0,
    },
  },
});
