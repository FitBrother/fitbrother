import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { removeStaleChannel, supabase } from "@/lib/supabase";
import { mealsForDayKey } from "./useMealsForDay";
import { dailySummaryKey } from "./useDailySummary";

/**
 * Subscribe a INSERT/UPDATE/DELETE em meals filtrando por user_id.
 * Invalida tanto mealsForDay quanto dailySummary — daily_summaries chega
 * num segundo evento via trigger, e adiantar a invalidação reduz latência
 * percebida.
 *
 * O filtro Postgres só aceita igualdade simples; `day` é deduzido pelo
 * consumed_at de cada payload (boundary não importa aqui — qualquer mudança
 * em meals do user dispara refetch).
 */
export function useMealsRealtime(userId: string | undefined, day: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId || !day) return;

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const topic = `meals:${userId}:${day}`;

    void removeStaleChannel(topic).then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(topic)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "meals",
            filter: `user_id=eq.${userId}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: mealsForDayKey(day) });
            qc.invalidateQueries({ queryKey: dailySummaryKey(day) });
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, day, qc]);
}
