"use client";

import { Info, RotateCcw } from "lucide-react";
import { ESSENTIALS_CHOICES_PAISE } from "@/lib/config";
import { useSambhal } from "@/lib/store";
import { Chip, Money, Sheet, TextButton } from "../ds";

export function MenuSheet({ onClose, onReset }: { onClose: () => void; onReset: () => void }) {
  const { state, dispatch, t, showToast } = useSambhal();
  return (
    <Sheet onClose={onClose} label={t("menu.title")}>
      <div className="space-y-5">
        <h2 className="pr-10 text-xl font-bold text-ink">{t("menu.title")}</h2>

        <div>
          <p className="mb-2 text-base font-semibold text-ink">{t("menu.essentials")}</p>
          <div className="flex flex-wrap gap-2">
            {ESSENTIALS_CHOICES_PAISE.map((p) => (
              <Chip key={p} selected={state.essentialsPaise === p} onClick={() => dispatch({ type: "setEssentials", paise: p })}>
                <Money paise={p} />
              </Chip>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">{t("ob.4.body")}</p>
        </div>

        <div className="divide-y divide-line border-t border-line">
          <TextButton
            icon={Info}
            tone="muted"
            className="w-full !justify-start"
            onClick={() => {
              dispatch({ type: "showIntro" });
              onClose();
            }}
          >
            {t("menu.intro")}
          </TextButton>
          <TextButton
            icon={RotateCcw}
            tone="red"
            className="w-full !justify-start"
            onClick={() => {
              onReset();
              onClose();
              showToast({ message: t("menu.resetDone") });
            }}
          >
            {t("menu.reset")}
          </TextButton>
        </div>
      </div>
    </Sheet>
  );
}
