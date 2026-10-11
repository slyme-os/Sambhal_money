"use client";

// The shell: demo ribbon, header (language + options), the current screen, a bottom
// action bar with the one primary action, and three tabs. A phone-width column on
// every screen size.

import { useCallback, useEffect, useRef, useState } from "react";
import { HandCoins, House, Languages, Minus, MoreHorizontal, PiggyBank, Plus, type LucideIcon } from "lucide-react";
import { LANGS, type MsgKey } from "@/lib/i18n";
import { onBackButton, styleStatusBar } from "@/lib/native";
import { SambhalStore, useSambhal } from "@/lib/store";
import { PrimaryButton, SecondaryButton, SkeletonScreen, ToastHost } from "./ds";
import { Home } from "./screens/Home";
import { Loan } from "./screens/Loan";
import { Onboarding } from "./screens/Onboarding";
import { PotDetail, Pots } from "./screens/Pots";
import { EntrySheet } from "./sheets/EntrySheet";
import { LanguageSheet } from "./sheets/LanguageSheet";
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
  | { kind: "language" }
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
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-canvas">
      <p role="note" translate="no" className="chrome-dark sticky top-0 z-[60] px-4 pb-1.5 pt-[calc(0.375rem+env(safe-area-inset-top))] text-center text-xs font-semibold leading-normal text-lime">
        {t("demo.ribbon")}
      </p>

      {!ready ? (
        <>
          <Header onMenu={() => undefined} onLanguage={() => undefined} />
          <SkeletonScreen />
        </>
      ) : !state.onboarded ? (
        <Onboarding />
      ) : (
        <>
          <Header onMenu={() => setSheet({ kind: "menu" })} onLanguage={() => setSheet({ kind: "language" })} />

          <main className="flex-1 pb-[calc(11.5rem+env(safe-area-inset-bottom))]">
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

          {/* Centred with inset + auto margins (not translate), so older WebViews lay it out right. */}
          <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px]">
            {tab !== "loan" && (
              <div className={`action-fade grid gap-2 px-4 pb-2 pt-6 ${tab === "home" ? "grid-cols-[minmax(0,1fr)_minmax(0,1.8fr)]" : "grid-cols-1"}`}>
                {tab === "home" && (
                  <SecondaryButton onClick={() => setSheet({ kind: "spend" })} className="!min-h-14 whitespace-nowrap !px-2 shadow-card" icon={Minus} ariaLabel={t("action.spent")}>
                    {t("action.spentShort")}
                  </SecondaryButton>
                )}
                <PrimaryButton icon={Plus} onClick={() => setSheet({ kind: "payment" })} className="whitespace-nowrap !px-3">
                  {t("action.payment")}
                </PrimaryButton>
              </div>
            )}
            <div className={`px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${tab === "loan" ? "action-fade pt-6" : "bg-canvas"}`}>
              <nav aria-label="Main" className="chrome-dark rounded-[22px] p-1.5 shadow-bar">
                <ul className="grid grid-cols-3 gap-1">
                  {TABS.map(({ id, key, Icon }) => {
                    const active = tab === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          aria-current={active ? "page" : undefined}
                          onClick={() => goTab(id)}
                          className={`press flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-[18px] text-sm ${active ? "bg-lime font-extrabold text-night" : "font-medium text-on-dark-3"}`}
                        >
                          <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden />
                          {t(key)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </div>
          </div>

          <ToastHost withActionBar={tab !== "loan"} />

          {sheet?.kind === "payment" && <PaymentSheet onClose={close} />}
          {sheet?.kind === "spend" && <SpendSheet onClose={close} />}
          {sheet?.kind === "withdraw" && <WithdrawSheet potId={sheet.potId} onClose={close} />}
          {sheet?.kind === "pot" && <PotSheet potId={sheet.potId} onClose={close} />}
          {sheet?.kind === "entry" && <EntrySheet id={sheet.id} onClose={close} />}
          {sheet?.kind === "language" && <LanguageSheet onClose={close} />}
          {sheet?.kind === "menu" && (
            <MenuSheet
              onClose={close}
              onLanguage={() => setSheet({ kind: "language" })}
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

function Header({ onMenu, onLanguage }: { onMenu: () => void; onLanguage: () => void }) {
  const { state, t } = useSambhal();
  const current = LANGS.find((l) => l.code === state.lang) ?? LANGS[0];
  return (
    <header className="flex items-center gap-3 px-4 pb-1 pt-3">
      <span aria-hidden className="chrome-dark grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-extrabold text-lime">
        ₹
      </span>
      <p className="min-w-0 flex-1 truncate text-lg font-extrabold text-ink" translate="no">
        {t("app.name")}
      </p>
      <button
        type="button"
        onClick={onLanguage}
        aria-label={`${t("lang.button")}: ${current.native}`}
        className="press flex min-h-12 shrink-0 items-center gap-1.5 rounded-full bg-card pl-3 pr-4 text-base font-bold text-ink shadow-card"
      >
        <Languages size={18} strokeWidth={2.2} aria-hidden className="text-green-700" />
        <span lang={current.code}>{current.native}</span>
      </button>
      <button type="button" onClick={onMenu} aria-label={t("menu.open")} className="press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card text-ink shadow-card">
        <MoreHorizontal size={24} aria-hidden />
      </button>
    </header>
  );
}
