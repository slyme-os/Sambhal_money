"use client";

// App state, saved on this phone (localStorage). The first render waits for the saved
// state so numbers never jump after load. The working day rolls over at 4 AM, checked
// on load and whenever the app comes back to the foreground.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { detectLang, isLang, translate, type MsgKey, type Vars } from "./i18n";
import { isState, reducer, seedState, type Action, type Lang, type State } from "./ledger";

const KEY = "sambhal:v1";

export interface Toast {
  id: number;
  message: string;
  undo?: () => void;
  tone?: "default" | "alert";
}

interface StoreValue {
  state: State;
  dispatch: (action: Action) => void;
  ready: boolean;
  lang: Lang;
  t: (key: MsgKey, vars?: Vars) => string;
  toast: Toast | null;
  showToast: (t: Omit<Toast, "id">) => void;
  dismissToast: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): State | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function SambhalStore({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => seedState(Date.now()));
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const saveFailed = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const t = useCallback((key: MsgKey, vars?: Vars) => translate(state.lang, key, vars), [state.lang]);

  const showToast = useCallback((next: Omit<Toast, "id">) => {
    clearTimeout(toastTimer.current);
    setToast({ ...next, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), next.undo ? 6000 : 3500);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  // Load once, then roll the day over if the phone was closed past 4 AM.
  useEffect(() => {
    const saved = load();
    if (saved) dispatch({ type: "hydrate", state: isLang(saved.lang) ? saved : { ...saved, lang: "hi" } });
    // First launch: start in the phone's own language; the picker is the first screen anyway.
    else dispatch({ type: "setLang", lang: detectLang(navigator.languages ?? [navigator.language]) });
    dispatch({ type: "rollover", now: Date.now() });
    setReady(true);
    const onVisible = () => document.visibilityState === "visible" && dispatch({ type: "rollover", now: Date.now() });
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      if (!saveFailed.current) {
        saveFailed.current = true;
        showToast({ message: translate(state.lang, "state.saveError"), tone: "alert" });
      }
    }
  }, [state, ready, showToast]);

  useEffect(() => {
    document.documentElement.lang = state.lang;
  }, [state.lang]);

  const value = useMemo(
    () => ({ state, dispatch, ready, lang: state.lang, t, toast, showToast, dismissToast }),
    [state, ready, t, toast, showToast, dismissToast],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useSambhal(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useSambhal must be used inside <SambhalStore>");
  return ctx;
}

/** A short unique id for new entries. */
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
