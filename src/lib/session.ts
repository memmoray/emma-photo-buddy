import { useCallback, useEffect, useState } from "react";

export const SESSION_STORAGE_KEY = "golden-hour-atx-session";

export function newSessionKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function readSessionKey() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function useSessionKey() {
  const [sessionKey, setSessionKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readSessionKey();
    if (stored) {
      setSessionKey(stored);
      return;
    }
    const created = newSessionKey();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    setSessionKey(created);
  }, []);

  const reset = useCallback(() => {
    const created = newSessionKey();
    window.localStorage.setItem(SESSION_STORAGE_KEY, created);
    setSessionKey(created);
    return created;
  }, []);

  return { sessionKey, reset };
}

export function askEmma(text: string) {
  window.dispatchEvent(new CustomEvent("emma:ask", { detail: text }));
  document.getElementById("chat")?.scrollIntoView({ behavior: "smooth", block: "center" });
}
