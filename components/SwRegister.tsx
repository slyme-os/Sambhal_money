"use client";

import { useEffect } from "react";
import { isNative } from "@/lib/native";

/** Registers the offline service worker in production web builds. The Android app
 *  bundles its files, so it needs no service worker. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || isNative() || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus; the app works without it */
    });
  }, []);
  return null;
}
