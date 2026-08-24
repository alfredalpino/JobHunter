import type { AppliedRecord, Job, Preferences, Profile } from "./types";

const KEY = "jobhunter.session.v1";

export type SessionState = {
  name: string;
  profile: Profile | null;
  preferences: Preferences | null;
  region: string;
  results: Job[] | null;
  huntedAt: string | null;
  applied?: Record<string, AppliedRecord>;
  showBandC?: boolean;
};

export function loadSession(): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function saveSession(state: Partial<SessionState>): void {
  if (typeof window === "undefined") return;
  const prev = loadSession() || {
    name: "",
    profile: null,
    preferences: null,
    region: "dubai",
    results: null,
    huntedAt: null,
  };
  localStorage.setItem(KEY, JSON.stringify({ ...prev, ...state }));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
