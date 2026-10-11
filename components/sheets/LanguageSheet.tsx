"use client";

// Language picker: big tiles, each language written in its own script, so a rider can
// find theirs without reading English. Used as the first onboarding screen and as a
// sheet from the header or the options menu.

import { Check } from "lucide-react";
import { LANGS, type Lang } from "@/lib/i18n";
import { useSambhal } from "@/lib/store";
import { Sheet } from "../ds";

/** "Choose your language" in the three most-used languages, for before a choice is made. */
export const CHOOSE_LANGUAGE_MULTI = "ಭಾಷೆ ಆರಿಸಿ · भाषा चुनें · Choose language";

export function LanguageList({ value, onPick }: { value: Lang; onPick: (lang: Lang) => void }) {
  return (
    <ul role="radiogroup" className="grid grid-cols-2 gap-2">
      {LANGS.map((l) => {
        const selected = l.code === value;
        return (
          <li key={l.code}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              lang={l.code}
              onClick={() => onPick(l.code)}
              className={`press relative flex min-h-[84px] w-full flex-col items-start justify-center rounded-2xl border-2 px-4 py-3 text-left ${
                selected ? "border-night bg-lime text-night" : "border-transparent bg-card text-ink shadow-card"
              }`}
            >
              <span className="text-xl font-extrabold leading-snug">{l.native}</span>
              <span className={`text-sm font-medium ${selected ? "text-night" : "text-muted"}`} lang="en">
                {l.english}
              </span>
              {selected && (
                <span aria-hidden className="chrome-dark absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full text-lime">
                  <Check size={15} strokeWidth={3} />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch, t } = useSambhal();
  return (
    <Sheet onClose={onClose} label={t("lang.title")}>
      <div className="space-y-4">
        <div className="pr-10">
          <h2 className="text-xl font-bold text-ink">{t("lang.title")}</h2>
          <p className="mt-1 text-sm text-muted" translate="no">{CHOOSE_LANGUAGE_MULTI}</p>
        </div>
        <LanguageList
          value={state.lang}
          onPick={(lang) => {
            dispatch({ type: "setLang", lang });
            onClose();
          }}
        />
        <p className="text-center text-sm text-muted">{t("lang.sub")}</p>
      </div>
    </Sheet>
  );
}
