// Bridge to the native SmsInbox plugin (android/app/.../SmsInboxPlugin.java). On the web
// and in older APKs the plugin is absent: smsSupported() is false and the app offers
// sample messages and "paste an SMS" instead.

import { Capacitor, registerPlugin } from "@capacitor/core";
import { parseSms, type DetectedTxn } from "./smsParse";

interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
}

interface SmsInboxPlugin {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  readSince(options: { since: number; limit?: number }): Promise<{ messages: SmsMessage[] }>;
}

const SmsInbox = registerPlugin<SmsInboxPlugin>("SmsInbox");

export const smsSupported = (): boolean => Capacitor.getPlatform() === "android" && Capacitor.isPluginAvailable("SmsInbox");

export async function requestSmsPermission(): Promise<boolean> {
  if (!smsSupported()) return false;
  try {
    return (await SmsInbox.requestPermission()).granted;
  } catch {
    return false;
  }
}

export async function hasSmsPermission(): Promise<boolean> {
  if (!smsSupported()) return false;
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
