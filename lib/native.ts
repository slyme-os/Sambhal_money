// Android (Capacitor) integration. Every function is a no-op in the browser, so the
// web build behaves exactly as before.

import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

export const isNative = () => Capacitor.isNativePlatform();

/**
 * Android back button. `handler` returns true when it handled the press (closed a
 * sheet, left a detail view, switched tab); otherwise the app exits, as Android expects
 * from the root screen.
 */
export function onBackButton(handler: () => boolean): () => void {
  if (!isNative()) return () => {};
  let remove: (() => void) | undefined;
  let cancelled = false;
  void import("@capacitor/app").then(({ App }) =>
    App.addListener("backButton", () => {
      if (!handler()) void App.exitApp();
    }).then((h) => {
      if (cancelled) void h.remove();
      else remove = () => void h.remove();
    }),
  );
  return () => {
    cancelled = true;
    remove?.();
  };
}

/** Light status-bar icons over the dark ribbon at the top of every screen. */
export function styleStatusBar(): void {
  if (!isNative()) return;
  void SystemBars.setStyle({ style: SystemBarsStyle.Dark });
}
