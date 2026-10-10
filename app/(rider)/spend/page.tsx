"use client";

// Log a spend — keeps "आज खर्च कर सकते हो" honest.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRider } from "@/components/StoreProvider";
import { AmountDisplay, Button, Chip, Keypad, Money, TopBar } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { logSpend, todayOf } from "@/lib/store/state";

const QUICK = [50, 100, 150, 200];

export default function SpendPage() {
  const { state, commit, now, t, toast } = useRider();
  const router = useRouter();
  const [digits, setDigits] = useState("");
  if (!state) return <TopBar back="/" title={t("logSpend")} />;
  const left = todayOf(state, now()).safeToSpendPaise;

  const save = () => {
    const paise = Number(digits) * 100;
    if (!paise) return;
    commit(logSpend(state, paise, now()));
    toast(t("spendSaved", { x: formatINR(paise).slice(1) }));
    router.push("/");
  };

  return (
    <div className="flex min-h-dvh flex-col lg:mx-auto lg:min-h-0 lg:max-w-xl">
      <TopBar back="/" title={t("logSpend")} />
      <div className="flex flex-1 flex-col px-4 pb-4 lg:rounded-3xl lg:border lg:border-line lg:bg-paper lg:p-6 lg:shadow-card">
        <p className="mt-4 text-center text-base font-semibold text-ink-2">{t("howMuchSpent")}</p>
        <AmountDisplay digits={digits} label={t("howMuchSpent")} />
        <p className="text-center text-sm text-ink-2">
          {t("safeToSpend")}: <Money paise={left} className="font-semibold text-ink" />
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK.map((q) => (
            <Chip key={q} selected={digits === String(q)} onClick={() => setDigits(String(q))}>
              ₹{q}
            </Chip>
          ))}
        </div>
        <div className="mt-auto pt-4">
          <Keypad value={digits} onChange={setDigits} />
          <Button full size="lg" className="mt-3" disabled={!digits} onClick={save}>
            {t("addSpend")}
          </Button>
        </div>
      </div>
    </div>
  );
}
