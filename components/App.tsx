"use client";

// The shell: demo ribbon, header (language + options), the current screen, a bottom
// action bar with the one primary action, and three tabs. A phone-width column on
// every screen size.

import { useCallback, useEffect, useRef, useState } from "react";
import { HandCoins, House, Minus, MoreHorizontal, PiggyBank, Plus, type LucideIcon } from "lucide-react";
import type { MsgKey } from "@/lib/i18n";
import { onBackButton, styleStatusBar } from "@/lib/native";
import { SambhalStore, useSambhal } from "@/lib/store";
import { PrimaryButton, SecondaryButton, SkeletonScreen, ToastHost } from "./ds";
import { Home } from "./screens/Home";
import { Loan } from "./screens/Loan";
import { Onboarding } from "./screens/Onboarding";
import { PotDetail, Pots } from "./screens/Pots";
import { EntrySheet } from "./sheets/EntrySheet";
import { MenuSheet } from "./sheets/MenuSheet";
import { PaymentSheet } from "./sheets/PaymentSheet";
import { PotSheet } from "./sheets/PotSheet";
import { SpendSheet } from "./sheets/SpendSheet";
import { WithdrawSheet } from "./sheets/WithdrawSheet";

type Tab = "home" | "pots" | "loan";

export type SheetState =
  | { kind: "payment" }
  | { kind: "spend" }
  | { kind: "withdraw"; potId: string }
  | { kind: "pot"; potId?: string }
  | { kind: "entry"; id: string }
  | { kind: "menu" }
  | null;

const TABS: { id: Tab; key: MsgKey; Icon: LucideIcon }[] = [
  { id: "home", key: "nav.home", Icon: House },
  { id: "pots", key: "nav.pots", Icon: PiggyBank },
  { id: "loan", key: "nav.loan", Icon: HandCoins },
];

export function SambhalApp() {
  return (
    <SambhalStore>
      <Shell />
    </SambhalStore>
  );
}

function Shell() {
  const { state, dispatch, ready, t } = useSambhal();
  const [tab, setTab] = useState<Tab>("home");
  const [potId, setPotId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = useCallback(() => setSheet(null), []);

  // Pot detail is a pushed view, so Android's back button returns to the list.
  const openPot = (id: string) => {
    window.history.pushState({ pot: id }, "");
    setPotId(id);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPop = () => setPotId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Android back: close a sheet, then leave pot detail, then go Home; exit from Home.
  const back = useRef<() => boolean>(() => false);
  back.current = () => {
    if (sheet) return setSheet(null), true;
    if (potId) return window.history.back(), true;
    if (state.onboarded && tab !== "home") return setTab("home"), true;
    return false;
  };
  useEffect(() => {
    styleStatusBar();
    return onBackButton(() => back.current());
  }, []);

  const goTab = (next: Tab) => {
    if (potId) window.history.back();
    setTab(next);
    window.scrollTo(0, 0);
  };

  const showPotDetail = tab === "pots" && potId && state.pots.some((p) => p.id === potId);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas min-[481px]:border-x min-[481px]:border-line">
      <p role="note" translate="no" className="sticky top-0 z-[60] bg-ink px-4 py-1.5 text-center text-xs font-semibold leading-normal text-white">
        {t("demo.ribbon")}
      </p>

      {!ready ? (
        <>
          <Header onMenu={() => undefined} />
          <SkeletonScreen />
        </>
      ) : !state.onboarded ? (
        <Onboarding />
      ) : (
        <>
          <Header onMenu={() => setSheet({ kind: "menu" })} />

          <main className="flex-1 pb-[calc(10rem+env(safe-area-inset-bottom))]">
            {tab === "home" && <Home onOpenEntry={(id) => setSheet({ kind: "entry", id })} />}
            {tab === "pots" &&
              (showPotDetail ? (
                <PotDetail
                  potId={potId}
                  onBack={() => window.history.back()}
                  onEdit={() => setSheet({ kind: "pot", potId })}
                  onWithdraw={() => setSheet({ kind: "withdraw", potId })}
                  onOpenEntry={(id) => setSheet({ kind: "entry", id })}
                />
              ) : (
                <Pots onOpenPot={openPot} onNewPot={() => setSheet({ kind: "pot" })} onOpenEntry={(id) => setSheet({ kind: "entry", id })} />
              ))}
            {tab === "loan" && <Loan />}
          </main>

          <div className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 bg-card shadow-bar">
            {tab !== "loan" && (
              <div className={`grid gap-2 px-4 pb-2 pt-3 ${tab === "home" ? "grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]" : "grid-cols-1"}`}>
                {tab === "home" && (
                  <SecondaryButton onClick={() => setSheet({ kind: "spend" })} className="!min-h-14 whitespace-nowrap !px-2" icon={Minus} ariaLabel={t("action.spent")}>
                    {t("action.spentShort")}
                  </SecondaryButton>
                )}
                <PrimaryButton icon={Plus} onClick={() => setSheet({ kind: "payment" })} className="whitespace-nowrap !px-3">
                  {t("action.payment")}
                </PrimaryButton>
              </div>
            )}
            <nav aria-label="Main" className="pb-safe border-t border-line">
              <ul className="grid grid-cols-3">
                {TABS.map(({ id, key, Icon }) => {
                  const active = tab === id;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => goTab(id)}
                        className={`press relative flex min-h-16 w-full flex-col items-center justify-center gap-0.5 text-sm ${active ? "font-bold text-green-700" : "font-medium text-muted"}`}
                      >
                        {active && <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-green-700" />}
                        <span className={`grid h-8 w-14 place-items-center rounded-full ${active ? "bg-green-50" : ""}`}>
                          <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden />
                        </span>
                        {t(key)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <ToastHost withActionBar={tab !== "loan"} />

          {sheet?.kind === "payment" && <PaymentSheet onClose={close} />}
          {sheet?.kind === "spend" && <SpendSheet onClose={close} />}
          {sheet?.kind === "withdraw" && <WithdrawSheet potId={sheet.potId} onClose={close} />}
          {sheet?.kind === "pot" && <PotSheet potId={sheet.potId} onClose={close} />}
          {sheet?.kind === "entry" && <EntrySheet id={sheet.id} onClose={close} />}
          {sheet?.kind === "menu" && (
            <MenuSheet
              onClose={close}
              onReset={() => {
                dispatch({ type: "reset", now: Date.now() });
                setPotId(null);
                setTab("home");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { state, dispatch, t } = useSambhal();
  return (
    <header className="flex items-center gap-3 px-4 pb-1 pt-3">
      <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-green-700 text-lg font-extrabold text-white">
        ₹
      </span>
      <p className="flex-1 text-lg font-extrabold text-ink" translate="no">
        {t("app.name")}
      </p>
      <button
        type="button"
        onClick={() => dispatch({ type: "setLang", lang: state.lang === "hi" ? "en" : "hi" })}
        aria-label={t("lang.switch")}
        className="press grid min-h-12 min-w-12 place-items-center rounded-xl border-2 border-line-strong px-3 text-base font-bold text-ink"
      >
        {t("lang.short")}
      </button>
      <button type="button" onClick={onMenu} aria-label={t("menu.open")} className="press grid h-12 w-12 place-items-center rounded-xl text-ink-2">
        <MoreHorizontal size={24} aria-hidden />
      </button>
    </header>
  );
}
