import type { CapacitorConfig } from "@capacitor/cli";

// Android app shell. The web app is exported as static files (out/) and bundled
// inside the APK, so the app works fully offline with no server.
const config: CapacitorConfig = {
  appId: "app.sambhal.money",
  appName: "Sambhal",
  webDir: "out",
  backgroundColor: "#111111",
  android: {
    // Plain https://localhost origin; localStorage persists across launches.
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#111111",
      showSpinner: false,
    },
    // Edge-to-edge: the dark ribbon and nav draw behind the system bars; the web app
    // pads with env(safe-area-inset-*). Light icons over the dark chrome.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};

export default config;
