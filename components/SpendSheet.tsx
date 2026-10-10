"use client";

import { useState } from "react";
import { formatINR, digitsToPaise } from "@/lib/money";
import { safeToSpend } from "@/lib/state";
import { useSambhal } from "@/lib/store";
import { Bi, Button, Keypad, Sheet } from "./ui";

export function SpendSheet({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useSambhal();
  const [digits, setDigits] = useState("");
  const amount = digitsToPaise(digits);
  const left = safeToSpend(state);

  return (
    <Sheet onClose={onClose} label="I spent">
      <div className="space-y-5">
        <Bi hi="खर्च हुआ" en="I spent" />

        <p className="num text-center text-5xl font-extrabold tracking-tight" aria-live="polite">
          {amount ? formatINR(amount) : <span className="text-muted">₹0</span>}
        </p>
        <p className="text-center text-sm text-muted">
          आज अभी {formatINR(left)} खर्च कर सकते हो · Safe to spend now: {formatINR(left)}
        </p>

        <Keypad value={digits} onChange={setDigits} />
        <Button
          disabled={!amount}
          onClick={() => {
            dispatch({ type: "spend", amountPaise: amount });
            onClose();
          }}
        >
          लिख लो · Save
        </Button>
      </div>
    </Sheet>
  );
}
