"use client";

// App state, saved on this phone (localStorage). The first render waits for the saved
// state so numbers never jump after load. The working day rolls over at 4 AM, checked
// on load and whenever the app comes back to the foreground.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { detectLang, isLang, translate, type MsgKey, type Vars } from "./i18n";
import { isState, reducer, seedState, type Action, type Lang, type State } from "./ledger";
import { getSmsMode, hasSmsPermission, onSharedText, readMoneySms, type SmsMode } from "./sms";
import { parseSms } from "./smsParse";
import { dayStart } from "./time";

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
  /** Reads new bank / UPI SMS into the inbox (Android, when SMS capture is on). */
  scanSms: () => Promise<void>;
  /** What this build can do with SMS: read the inbox, receive shares, or web demo. */
  smsMode: SmsMode;
  /** Bumps when an SMS is shared to the app, so the shell can open the inbox. */
  shareTick: number;
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

  const [smsMode, setSmsMode] = useState<SmsMode>("web");
  const [shareTick, setShareTick] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const modeRef = useRef<SmsMode>("web");

  useEffect(() => {
    void getSmsMode().then((m) => {
      modeRef.current = m;
      setSmsMode(m);
    });
  }, []);

  // "Share → Sambhal" from the SMS app: parse the shared text into the inbox and open it.
  useEffect(() => {
    if (!ready) return;
    return onSharedText((text) => {
      const txn = parseSms(text, Date.now());
      const lang = stateRef.current.lang;
      if (!txn) {
        showToast({ message: translate(lang, "sms.pasteNone"), tone: "alert" });
        return;
      }
      if (!stateRef.current.sms.enabled) dispatch({ type: "smsEnable" });
      dispatch({ type: "smsFound", txns: [txn], scannedAt: stateRef.current.sms.lastScanAt });
      setShareTick((n) => n + 1);
    });
  }, [ready, showToast]);

  const scanSms = useCallback(async () => {
    const s = stateRef.current;
    if (!s.sms.enabled || modeRef.current !== "auto" || !(await hasSmsPermission())) return;
    // Start the next read from when this one began, so an SMS arriving mid-read isn't lost.
    const started = Date.now();
    try {
      const txns = await readMoneySms(Math.max(s.sms.lastScanAt, dayStart(s.day)));
      dispatch({ type: "smsFound", txns, scannedAt: started });
    } catch {
      /* permission revoked or inbox unreadable: try again next time */
    }
  }, []);

  // SMS capture: check on open, on return to the app, and every 30s while it's open.
  useEffect(() => {
    if (!ready || !state.sms.enabled || smsMode !== "auto") return;
    void scanSms();
    const visible = () => document.visibilityState === "visible";
    const onVisible = () => visible() && void scanSms();
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, 30_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [ready, state.sms.enabled, smsMode, scanSms]);

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
    () => ({ state, dispatch, ready, lang: state.lang, t, toast, showToast, dismissToast, scanSms, smsMode, shareTick }),
    [state, ready, t, toast, showToast, dismissToast, scanSms, smsMode, shareTick],
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
