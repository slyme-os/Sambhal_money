// Turns a ledger entry into what a TransactionRow shows: what happened, where the
// money went, and how much.

import { SOURCES } from "@/lib/config";
import type { MsgKey, Vars } from "@/lib/i18n";
import type { Entry, State } from "@/lib/ledger";
import { formatINR } from "@/lib/money";
import { potName } from "./ds";

type T = (k: MsgKey, v?: Vars) => string;
type Activity = Exclude<Entry, { kind: "opening" }>;

export function sourceLabel(id: string, t: T): string {
  const s = SOURCES.find((x) => x.id === id);
  return s?.label ?? t("src.cash");
}

export function rowFor(e: Activity, s: State, t: T): { kind: "in" | "out" | "withdraw"; title: string; sub: string; paise: number } {
  if (e.kind === "payout") {
    const toPots = Object.values(e.alloc).reduce((a, b) => a + b, 0);
    const sub =
      toPots === 0
        ? t("row.toEssentials")
        : e.toEssentialsPaise > 0
          ? t("row.split", { essentials: formatINR(e.toEssentialsPaise), pots: formatINR(toPots) })
          : t("row.toPots", { amount: formatINR(toPots) });
    return { kind: "in", title: t("row.payment", { source: sourceLabel(e.source, t) }), sub, paise: e.amountPaise };
  }
  if (e.kind === "spend") return { kind: "out", title: t("row.spend"), sub: t("row.fromSafe"), paise: e.amountPaise };
  const pot = s.pots.find((p) => p.id === e.potId);
  return { kind: "withdraw", title: t("row.withdraw", { pot: pot ? potName(pot, t) : "" }), sub: t("row.toBank"), paise: e.amountPaise };
}
