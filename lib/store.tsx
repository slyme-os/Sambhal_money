"use client";

// All state lives here, in memory, seeded from lib/seed.ts. Nothing is persisted:
// the demo starts the same way every time.

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { reducer, type Action } from "./state";
import { seedState, type SambhalState } from "./seed";

interface StoreValue {
  state: SambhalState;
  dispatch: (action: Action) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function SambhalStore({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useSambhal(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useSambhal must be used inside <SambhalStore>");
  return ctx;
}
