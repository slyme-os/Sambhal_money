"use client";

import { useEffect } from "react";

/** Registers the offline service worker in production builds only. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  }, []);
  return null;
}
