# Sambhal for Android

The Android app is the same Next.js app, exported as static files and bundled inside
a native shell (Capacitor 8). It runs fully offline: no server, no hosting. Data is
saved on the phone.

- App ID: `app.sambhal.money` (permanent once published on Play — change it in
  `capacitor.config.ts` and `android/app/build.gradle` **before** the first upload if you
  want a different one)
- Android 7.0+ (minSdk 24), targets Android 16 (SDK 36)
- Back button: closes a sheet → leaves pot detail → goes Home → exits

## 1. Get a test APK (no setup)

Every push to `feat/gmoney-mvp` or `main` runs the **Android** workflow on GitHub
Actions, which builds a debug APK.

1. GitHub → repo → **Actions** → latest **Android** run → **Artifacts** →
   `sambhal-debug-apk-<n>` (a zip containing `app-debug.apk`).
2. Send the APK to an Android phone (WhatsApp/Drive/USB), open it, allow
   "Install unknown apps" for that app once, and install.

You can also start a build by hand: Actions → Android → **Run workflow**.

## 2. Build on your own computer (optional)

Needs Node 22, JDK 21 and Android Studio (for the Android SDK).

```bash
npm ci
npm run android:sync     # static export into out/ + copy into android/
npm run android:open     # opens Android Studio → Run ▶ on a phone/emulator
# or, from the command line:
npm run android:apk      # → android/app/build/outputs/apk/debug/app-debug.apk
```

After any change to the web app, run `npm run android:sync` again.

## 3. Publish on Google Play (only you can do these)

1. **Play Console account** — https://play.google.com/console, one-time US$25 fee,
   identity verification. A company account needs a D-U-N-S number.
2. **Upload key** — create it once and keep it safe (losing it blocks updates):
   ```bash
   keytool -genkey -v -keystore sambhal-upload.jks -alias sambhal -keyalg RSA -keysize 2048 -validity 10000
   ```
3. **Add four GitHub secrets** (repo → Settings → Secrets and variables → Actions):
   `ANDROID_KEYSTORE_BASE64` (`base64 -w0 sambhal-upload.jks`), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`sambhal`), `ANDROID_KEY_PASSWORD`. The next push also produces
   `sambhal-release-<n>` with a signed `app-release.aab` (upload this to Play) and APK.
4. **Store listing** — name, short and full description (Hindi + English), the 512×512
   icon at `android/play-store-icon-512.png`, a 1024×500 feature graphic, and 2–8 phone
   screenshots.
5. **Policy forms** — privacy policy URL (required), Data safety (today: data stays on
   the device, nothing collected or shared), content rating, target audience (18+).
6. **Financial features declaration** — Play asks every finance app. The Loan screen
   shows eligibility and names a partner NBFC; in India, Play's personal-loan policy
   expects the NBFC's name and RBI registration and a link to it. **Get legal sign-off
   before submitting**, or ship v1 without the Loan tab.
7. **Testing track first** — new personal developer accounts must run a closed test
   (at least 12 testers for 14 days) before production access.

## Before a real release

- Remove the demo ribbon and the sample data (`seedState` in `lib/ledger.ts`) so a new
  install starts empty.
- Replace the `CREDIT` demo figures in `lib/config.ts`.
