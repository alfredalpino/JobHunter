/** Browser-only Gemini key storage — never persisted server-side or in a DB. */

export const GEMINI_KEY_STORAGE = "jobhunter.geminiKey.v1";
export const AI_POLISH_STORAGE = "jobhunter.aiPolish.v1";

export function loadGeminiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(GEMINI_KEY_STORAGE)?.trim() || "";
  } catch {
    return "";
  }
}

export function saveGeminiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = key.trim();
    if (trimmed) sessionStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    else sessionStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function clearGeminiKey(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(GEMINI_KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export function loadAiPolishPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(AI_POLISH_STORAGE) === "1";
  } catch {
    return false;
  }
}

export function saveAiPolishPref(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) sessionStorage.setItem(AI_POLISH_STORAGE, "1");
    else sessionStorage.removeItem(AI_POLISH_STORAGE);
  } catch {
    /* ignore */
  }
}
