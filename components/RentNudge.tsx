"use client";

// S4 — the actual product. A payout lands, rent is due soon, the rent pot covers
// it: "₹1,420 अभी आया। किराया ₹2,450 अभी भेज दो?" One tap opens the rider's own UPI
// app with the payment pre-filled. We never touch the money (HR-1), so when he
// comes back we ask "भेज दिया?" and record his answer as a provisional report.

import { BellRing, Send } from "lucide-react";
import { useRider } from "@/components/StoreProvider";
import { Button, Money, Sheet } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { confirmRent, dismissNudge, startRentPayment } from "@/lib/store/state";
import type { Nudge } from "@/lib/types";

export function useRentPayment() {
  const { state, commit, now } = useRider();
  return (rentEventId: string, nudgeId: string | null) => {
    if (!state) return;
    const { state: next, upiLink } = startRentPayment(state, rentEventId, nudgeId, now());
    commit(next);
    // Hand off to the rider's UPI app (GPay / PhonePe / Paytm / BHIM).
    window.location.href = upiLink;
  };
}

/** Shows a system notification for the nudge when the rider has allowed it. */
export async function notifyNudge(title: string, body: string): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = navigator.serviceWorker?.controller ? await navigator.serviceWorker.ready : null;
    if (reg) await reg.showNotification(title, { body, tag: "rent-nudge", icon: "/icons/192", data: { url: "/" } });
    else new Notification(title, { body, tag: "rent-nudge", icon: "/icons/192" });
  } catch {
    /* notifications are a bonus; the in-app banner is the source of truth */
  }
}

export function RentNudge({ nudge }: { nudge: Nudge }) {
  const { state, commit, now, t } = useRider();
  const pay = useRentPayment();
  if (!state) return null;
  const payout = state.payouts.find((p) => p.id === nudge.context.payoutId);
  return (
    <section
      aria-live="polite"
      className="nudge-in overflow-hidden rounded-2xl border-2 border-amber bg-amber-tint shadow-raised"
    >
      <div className="flex gap-3 p-4">
        <span aria-hidden className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber">
          <BellRing size={22} />
        </span>
        <div>
          <p className="text-lg font-extrabold leading-snug tracking-tight">
            {t("nudgeTitle", {
              payout: formatINR(payout?.amountPaise ?? 0).slice(1),
              rent: formatINR(nudge.context.amountPaise).slice(1),
            })}
          </p>
          <p className="mt-1 text-base text-ink">{t("nudgeBody")}</p>
          {state.mode === "demo" && <p className="mt-2 text-sm font-semibold text-amber-ink">{t("upiDemoWarning")}</p>}
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 px-4 pb-4">
        <Button size="lg" onClick={() => pay(nudge.context.rentEventId, nudge.id)}>
          <Send size={20} aria-hidden /> {t("nudgeYes")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => commit(dismissNudge(state, nudge.id, now()))}>
          {t("nudgeLater")}
        </Button>
      </div>
    </section>
  );
}

/** "भेज दिया?" — shown whenever a UPI hand-off is pending. */
export function RentConfirmSheet() {
  const { state, commit, now, t, toast } = useRider();
  const pending = state?.pendingRent;
  if (!state || !pending) return null;
  const ev = state.rentEvents.find((e) => e.id === pending.rentEventId);
  const answer = (paid: boolean) => {
    commit(confirmRent(state, paid, now()));
    if (paid) toast(t("rentRecorded"));
  };
  return (
    <Sheet open onClose={() => answer(false)} title={t("didYouSend")} tone="amber">
      <p className="text-lg">
        {t("didYouSendSub", { rent: formatINR(ev?.amountPaise ?? 0).slice(1), payee: state.rentAgreement?.payeeName ?? "" })}
      </p>
      <p className="mt-2 text-sm text-ink-2">{t("upiOpenFailed")}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={() => answer(true)}>
          {t("yes")}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => answer(false)}>
          {t("no")}
        </Button>
      </div>
      {ev && (
        <p className="mt-4 text-center text-sm text-ink-2">
          <Money paise={ev.amountPaise} className="font-semibold text-ink" /> · {ev.dueOn}
        </p>
      )}
    </Sheet>
  );
}
