import type { CapacitorConfig } from "@capacitor/cli";

// Android app shell. The web app is exported as static files (out/) and bundled
// inside the APK, so the app works fully offline with no server.
const config: CapacitorConfig = {
  appId: "app.sambhal.money",
  appName: "Sambhal",
  webDir: "out",
  backgroundColor: "#f5f8f6",
  android: {
    // Plain https://localhost origin; localStorage persists across launches.
    allowMixedContent: false,
    captureInput: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#17593b",
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: "#0f1f17",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
