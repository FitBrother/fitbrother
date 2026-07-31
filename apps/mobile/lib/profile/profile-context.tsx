import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe } from "@/lib/api";
import type { Profile } from "./types";

type State =
  | { status: "loading" }
  | { status: "ready"; profile: Profile }
  | { status: "missing" }
  | { status: "error"; message: string };

type ContextValue = State & {
  refresh: () => Promise<void>;
  update: (patch: Partial<Profile>) => void;
};

const ProfileContext = createContext<ContextValue>({
  status: "loading",
  refresh: async () => {},
  update: () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      // getMe() returns { profile, nutrition_goal, anthropometric } or null
      const data = (await getMe()) as { profile: Profile } | null;
      const profile = data?.profile ?? null;
      setState(profile ? { status: "ready", profile } : { status: "missing" });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "profile_load_failed",
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback((patch: Partial<Profile>) => {
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", profile: { ...current.profile, ...patch } }
        : current,
    );
  }, []);

  return (
    <ProfileContext.Provider value={{ ...state, refresh: load, update }}>
      {children}
    </ProfileContext.Provider>
  );
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

export function useProfileActions() {
  const { refresh, update } = useContext(ProfileContext);
  return { refresh, update };
}
