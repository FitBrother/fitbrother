import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/lib/api";
import type { Profile } from "./types";

type State =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "missing" }
  | { status: "error"; message: string };

const ProfileContext = createContext<State>({ status: "loading" });

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // getMe() returns { profile, nutrition_goal, anthropometric } or null
        const data = (await getMe()) as { profile: Profile } | null;
        if (cancelled) return;
        const profile = data?.profile ?? null;
        setState(profile ? { status: "ready", profile } : { status: "missing" });
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "error",
          message: e instanceof Error ? e.message : "profile_load_failed",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <ProfileContext.Provider value={state}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Profile {
  const state = useContext(ProfileContext);
  if (state.status !== "ready") {
    throw new Error(`useProfile called while status=${state.status}`);
  }
  return state.profile;
}

export function useProfileState(): State {
  return useContext(ProfileContext);
}
