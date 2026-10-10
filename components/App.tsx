"use client";

// The whole app: one header, three tabs (घर / गुल्लक / लोन) in a floating pill, and two
// sheets for logging a payout or a spend. A phone-width column on every screen size.

import { useState } from "react";
import { HandCoins, House, PiggyBank } from "lucide-react";
import { APP_NAME_HI, APP_NAME } from "@/lib/config";
import { SambhalStore } from "@/lib/store";
import { Home } from "./Home";
import { Loan } from "./Loan";
import { PayoutSheet } from "./PayoutSheet";
import { Pots } from "./Pots";
import { SpendSheet } from "./SpendSheet";

type Tab = "home" | "pots" | "loan";

const TABS: { id: Tab; hi: string; en: string; Icon: typeof House }[] = [
  { id: "home", hi: "घर", en: "Home", Icon: House },
  { id: "pots", hi: "गुल्लक", en: "Pots", Icon: PiggyBank },
  { id: "loan", hi: "लोन", en: "Loan", Icon: HandCoins },
];

export function SambhalApp() {
  return (
    <SambhalStore>
      <Shell />
    </SambhalStore>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<"payout" | "spend" | null>(null);
  const close = () => setSheet(null);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-bg lg:max-w-[1040px] sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-[2rem] sm:border sm:border-line sm:shadow-raised">
      <header className="flex items-center gap-3 px-5 pb-2 pt-5">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-lg font-bold text-ink">₹</span>
        <div className="flex-1">
          <p className="text-base font-semibold leading-tight">{APP_NAME_HI}</p>
          <p className="text-xs text-muted">{APP_NAME}</p>
        </div>
      </header>

      <main className="flex-1 pb-36">
        {tab === "home" && <Home onPayout={() => setSheet("payout")} onSpend={() => setSheet("spend")} />}
        {tab === "pots" && <div className="lg:mx-auto lg:max-w-[430px]"><Pots /></div>}
        {tab === "loan" && <div className="lg:mx-auto lg:max-w-[430px]"><Loan /></div>}
      </main>

      <nav aria-label="Main" className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[398px] -translate-x-1/2 rounded-full border border-line bg-paper p-1.5 shadow-float">
        <ul className="grid grid-cols-3 gap-1">
          {TABS.map(({ id, hi, en, Icon }) => {
            const active = tab === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => setTab(id)}
                  className={`press flex min-h-14 w-full flex-col items-center justify-center rounded-full ${active ? "bg-lime text-ink" : "text-muted"}`}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
                  <span className="text-sm font-semibold leading-tight">{hi}</span>
                  <span className="text-xs leading-tight">{en}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {sheet === "payout" && <PayoutSheet onClose={close} />}
      {sheet === "spend" && <SpendSheet onClose={close} />}
    </div>
  );
}
