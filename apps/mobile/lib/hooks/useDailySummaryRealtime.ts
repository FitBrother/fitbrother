import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dailySummaryKey } from "./useDailySummary";

/**
 * Subscribe ao canal Postgres Changes de daily_summaries filtrando por user_id.
 * Invalida React Query quando chega UPDATE da row do dia ativo.
 *
 * Note: o filtro Postgres só aceita igualdade simples; comparamos `day` no
 * cliente porque UPDATEs em dias passados (edição de meal antigo) também
 * chegam ao canal.
 */
export function useDailySummaryRealtime(userId: string | undefined, day: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId || !day) return;

    const channel = supabase
      .channel(`ds:${userId}:${day}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "daily_summaries",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newDay = (payload.new as { day?: string }).day;
          if (newDay === day) {
            qc.invalidateQueries({ queryKey: dailySummaryKey(day) });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, day, qc]);
}
