"use client";

// App frame. Phones get a bottom tab bar (thumb reach); desktops (≥1024px) get a
// left sidebar with the primary actions, navigation and language switch, and the
// content area widens into multi-column layouts.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartColumn, House, PiggyBank, Settings, ShieldAlert } from "lucide-react";
import { RentConfirmSheet } from "@/components/RentNudge";
import { useRider } from "@/components/StoreProvider";
import { APP_NAME } from "@/lib/config";
import { updateSettings } from "@/lib/store/state";
import type { StringKey } from "@/lib/strings";
import type { Lang } from "@/lib/types";

const TABS: { href: string; key: StringKey; Icon: typeof House }[] = [
  { href: "/", key: "navHome", Icon: House },
  { href: "/pots", key: "navPots", Icon: PiggyBank },
  { href: "/hisab", key: "navHisab", Icon: ChartColumn },
  { href: "/settings", key: "navSettings", Icon: Settings },
];

export function RiderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, toasts } = useRider();
  const showTabs = TABS.some((tab) => tab.href === pathname);
  const showSidebar = pathname !== "/onboarding";

  return (
    <div className="min-h-dvh bg-paper sm:bg-surface">
      {showSidebar && <Sidebar pathname={pathname} />}

      <div className={`relative mx-auto min-h-dvh w-full max-w-[480px] bg-paper sm:border-x sm:border-line lg:max-w-none lg:border-0 lg:bg-transparent ${showSidebar ? "lg:pl-64" : ""}`}>
        <main key={pathname} className={`screen-in ${showTabs ? "pb-24" : ""} lg:px-10 lg:pb-12 lg:pt-6`}>
          <div className="lg:mx-auto lg:max-w-5xl">{children}</div>
        </main>
      </div>

      {showTabs && (
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] border-t border-line bg-paper pb-safe lg:hidden">
          <ul className="grid grid-cols-4">
            {TABS.map(({ href, key, Icon }) => {
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`press flex h-16 flex-col items-center justify-center gap-0.5 text-sm font-semibold ${active ? "text-brand" : "text-ink-2"}`}
                  >
                    <Icon size={24} strokeWidth={active ? 2.6 : 2} aria-hidden />
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <RentConfirmSheet />

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto flex max-w-[480px] flex-col items-center gap-2 px-4 lg:inset-x-auto lg:bottom-8 lg:right-8 lg:mx-0 lg:max-w-sm lg:items-end lg:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`toast-in rounded-xl px-4 py-3 text-base font-semibold shadow-raised ${toast.tone === "warn" ? "bg-alert text-white" : "bg-ink text-white"}`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { state, commit, now, t } = useRider();
  const setLang = (language: Lang) => state && commit(updateSettings(state, { language }, now()));
  const lang = state?.rider.language === "hi" ? "hi" : "en";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-paper px-4 py-6 lg:flex">
      <Link href="/" className="flex items-center gap-3 px-2">
        <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xl font-extrabold text-white">
          ₹
        </span>
        <span className="text-xl font-extrabold tracking-tight">{APP_NAME}</span>
        {state?.mode === "demo" && (
          <span className="ml-auto rounded-full bg-info-tint px-2.5 py-0.5 text-sm font-semibold text-info">{t("demoBadge")}</span>
        )}
      </Link>

      <div className="mt-8 grid gap-2">
        <Link href="/payout" className="press flex min-h-12 items-center justify-center rounded-xl bg-brand text-base font-extrabold text-white shadow-card active:bg-brand-pressed">
          + {t("logPayout")}
        </Link>
        <Link href="/spend" className="press flex min-h-12 items-center justify-center rounded-xl border-2 border-line text-base font-semibold active:bg-surface">
          − {t("logSpend")}
        </Link>
      </div>

      <nav aria-label="Main" className="mt-8">
        <ul className="grid gap-1">
          {TABS.map(({ href, key, Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`press flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-semibold ${
                    active ? "bg-brand-tint text-brand-pressed" : "text-ink-2 hover:bg-surface hover:text-ink"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.6 : 2} aria-hidden />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link
        href="/shock"
        className={`press mt-4 flex min-h-12 items-center gap-3 rounded-xl border-2 border-alert/30 bg-alert-tint px-3 text-base font-semibold ${pathname === "/shock" ? "text-alert" : ""}`}
      >
        <ShieldAlert size={22} className="shrink-0 text-alert" aria-hidden />
        {t("shockPrompt")}
      </Link>

      <div className="mt-auto space-y-3">
        <div role="radiogroup" aria-label={t("language")} className="flex gap-1 rounded-xl bg-surface p-1">
          {(
            [
              ["en", "English"],
              ["hi", "हिंदी"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={lang === value}
              onClick={() => setLang(value)}
              className={`press min-h-10 flex-1 rounded-lg text-sm font-semibold ${lang === value ? "bg-paper shadow-card" : "text-ink-2"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link href="/operator" className="block px-2 text-sm font-semibold text-info underline">
          {t("operatorLink")}
        </Link>
        <p className="px-2 text-sm text-ink-2">{t("noFees")}</p>
      </div>
    </aside>
  );
}
