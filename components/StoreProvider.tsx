"use client";

// Holds the rider's state for the whole rider app. All rules live in the pure
// functions of lib/store/state.ts; this provider only stores the current value,
// persists it to the device, and re-syncs when the app comes back to the front.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { demoState, loadRider, saveRider } from "@/lib/store/persist";
import { sync, type RiderState } from "@/lib/store/state";
import { translate, type StringKey } from "@/lib/strings";
import type { Lang } from "@/lib/types";

export type ToastTone = "ok" | "warn" | "info";
export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface StoreValue {
  /** null until loaded from the device (first paint shows a skeleton). */
  state: RiderState | null;
  lang: Lang;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  now: () => string;
  commit: (next: RiderState) => void;
  /** Replace the whole state; null restarts the seeded demo. */
  reset: (next: RiderState | null) => void;
  toast: (text: string, tone?: ToastTone) => void;
  toasts: Toast[];
}

const StoreContext = createContext<StoreValue | null>(null);

const now = () => new Date().toISOString();

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RiderState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => {
    const at = now();
    setState(sync(loadRider() ?? demoState(at), at));
    const onVisible = () => {
      if (document.visibilityState === "visible") setState((s) => (s ? sync(s, now()) : s));
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (state) saveRider(state);
  }, [state]);

  const language = state?.rider.language;
  useEffect(() => {
    if (language) document.documentElement.lang = language === "en" ? "en" : "hi";
  }, [language]);

  const toast = useCallback((text: string, tone: ToastTone = "ok") => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-1), { id, text, tone }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 3200);
  }, []);

  const reset = useCallback((next: RiderState | null) => {
    setState(next ?? demoState(now()));
  }, []);

  const lang: Lang = language ?? "en";
  const value = useMemo<StoreValue>(
    () => ({
      state,
      lang,
      t: (key, vars) => translate(lang, key, vars),
      now,
      commit: setState,
      reset,
      toast,
      toasts,
    }),
    [state, lang, reset, toast, toasts],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useRider(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useRider must be used inside <StoreProvider>");
  return ctx;
}
