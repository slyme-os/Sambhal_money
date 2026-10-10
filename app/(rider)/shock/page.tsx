"use client";

// S5 — the shock log. Amount, what happened, and how he covered it. That last
// field is the company's primary metric, so this screen is built to take < 20s:
// three taps and a number.

import { Ban, HandCoins, Ellipsis, PiggyBank } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRider } from "@/components/StoreProvider";
import { AmountDisplay, Button, Chip, Keypad, Toggle, TopBar } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { balancesOf, logShock } from "@/lib/store/state";
import type { StringKey } from "@/lib/strings";
import type { ShockCover } from "@/lib/types";

const WHAT: { key: StringKey; value: string }[] = [
  { key: "shockBike", value: "Bike repair" },
  { key: "shockPuncture", value: "Puncture" },
  { key: "shockSick", value: "Fell sick" },
  { key: "shockPhone", value: "Phone" },
  { key: "shockFamily", value: "Family" },
  { key: "shockOther", value: "Other" },
];

const COVER: { value: ShockCover; key: StringKey; Icon: typeof Ban; tone: string }[] = [
  { value: "pot", key: "coverPot", Icon: PiggyBank, tone: "border-brand bg-brand-tint" },
  { value: "borrowed", key: "coverBorrowed", Icon: HandCoins, tone: "border-alert bg-alert-tint" },
  { value: "unpaid", key: "coverUnpaid", Icon: Ban, tone: "border-alert bg-alert-tint" },
  { value: "other", key: "coverOther", Icon: Ellipsis, tone: "border-ink-2 bg-surface" },
];

export default function ShockPage() {
  const { state, commit, now, t, toast } = useRider();
  const router = useRouter();
  const [digits, setDigits] = useState("");
  const [what, setWhat] = useState<string | null>(null);
  const [cover, setCover] = useState<ShockCover | null>(null);
  const [fromPot, setFromPot] = useState(true);
  if (!state) return <TopBar back="/" title={t("shockTitle")} />;

  const paise = Number(digits) * 100;
  const emergency = balancesOf(state).emergency;
  const take = Math.min(paise, emergency);

  const save = () => {
    if (!cover) return;
    commit(
      logShock(
        state,
        { amountPaise: paise, description: what ?? "", coveredBy: cover, takeFromEmergencyPaise: cover === "pot" && fromPot ? take : 0 },
        now(),
      ),
    );
    toast(t("shockSaved"));
    router.push("/");
  };

  return (
    <div className="lg:mx-auto lg:max-w-xl">
      <TopBar back="/" title={t("shockTitle")} />
      <div className="px-4 pb-8 lg:rounded-3xl lg:border lg:border-line lg:bg-paper lg:p-6 lg:shadow-card">
        <p className="mt-3 text-base font-semibold text-ink-2">{t("shockHowMuch")}</p>
        <AmountDisplay digits={digits} label={t("shockHowMuch")} />
        <Keypad value={digits} onChange={setDigits} compact />

        <p className="mb-2 mt-5 text-base font-semibold text-ink-2">{t("shockWhat")}</p>
        <div className="flex flex-wrap gap-2">
          {WHAT.map((w) => (
            <Chip key={w.value} selected={what === w.value} onClick={() => setWhat(w.value)}>
              {t(w.key)}
            </Chip>
          ))}
        </div>

        <p className="mb-2 mt-5 text-base font-semibold text-ink-2">{t("shockHow")}</p>
        <div role="radiogroup" aria-label={t("shockHow")} className="grid grid-cols-2 gap-2">
          {COVER.map(({ value, key, Icon, tone }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={cover === value}
              onClick={() => setCover(value)}
              className={`press flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-base font-extrabold ${
                cover === value ? tone : "border-line bg-paper"
              }`}
            >
              <Icon size={26} aria-hidden />
              {t(key)}
            </button>
          ))}
        </div>

        {cover === "pot" && take > 0 && (
          <div className="mt-3 rounded-2xl bg-brand-tint px-3">
            <Toggle checked={fromPot} onChange={setFromPot} label={t("shockTakeFromPot", { x: formatINR(take).slice(1) })} sub={t("withdrawEtaSub")} />
          </div>
        )}

        <Button full size="lg" className="mt-6" disabled={!cover} onClick={save}>
          {t("shockSave")}
        </Button>
      </div>
    </div>
  );
}
