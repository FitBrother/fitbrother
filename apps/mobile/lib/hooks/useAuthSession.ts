import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AuthState =
  | { status: "loading" }
  | { status: "signed_in"; session: Session }
  | { status: "signed_out" };

export function useAuthSession(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState(
        data.session ? { status: "signed_in", session: data.session } : { status: "signed_out" },
      );
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(session ? { status: "signed_in", session } : { status: "signed_out" });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return state;
}
