// Bridge to the native SmsInbox plugin (android/app/.../SmsInboxPlugin.java).
// Modes:
//  - "auto":  Play Store build (declares READ_SMS): reads bank / UPI SMS from the inbox.
//  - "share": sideloaded APK (no SMS permission, so Play Protect allows the install):
//             riders share an SMS to Sambhal, or paste it.
//  - "web":   browser / older APKs: sample messages and paste.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { parseSms, type DetectedTxn } from "./smsParse";

interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
}

export type SmsMode = "auto" | "share" | "web";

interface SmsInboxPlugin {
  capabilities(): Promise<{ canRead: boolean }>;
  addListener(event: "sharedText", cb: (data: { text: string }) => void): Promise<{ remove: () => Promise<void> }>;
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  readSince(options: { since: number; limit?: number }): Promise<{ messages: SmsMessage[] }>;
}

const SmsInbox = registerPlugin<SmsInboxPlugin>("SmsInbox");

const pluginPresent = (): boolean => Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("SmsInbox");

/** Which SMS features this build has. */
export async function getSmsMode(): Promise<SmsMode> {
  if (!pluginPresent()) return "web";
  try {
    return (await SmsInbox.capabilities()).canRead ? "auto" : "share";
  } catch {
    return "share";
  }
}

/** Text shared to Sambhal from another app (e.g. a bank SMS). Returns an unsubscribe. */
export function onSharedText(cb: (text: string) => void): () => void {
  if (!pluginPresent()) return () => {};
  let remove: (() => Promise<void>) | undefined;
  let stopped = false;
  void SmsInbox.addListener("sharedText", (d) => cb(d.text)).then((h) => {
    if (stopped) void h.remove();
    else remove = h.remove;
  });
  return () => {
    stopped = true;
    void remove?.();
  };
}

export async function requestSmsPermission(): Promise<boolean> {
  if (!pluginPresent()) return false;
  try {
    return (await SmsInbox.requestPermission()).granted;
  } catch {
    return false;
  }
}

export async function hasSmsPermission(): Promise<boolean> {
  if (!pluginPresent()) return false;
  try {
    return (await SmsInbox.checkPermission()).granted;
  } catch {
    return false;
  }
}

/** Money SMS since `since`, parsed. The message text is dropped right here. */
export async function readMoneySms(since: number): Promise<DetectedTxn[]> {
  const { messages } = await SmsInbox.readSince({ since, limit: 300 });
  return messages.map((m) => parseSms(m.body, m.date)).filter((t): t is DetectedTxn => t !== null);
}
