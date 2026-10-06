import { useState, useEffect } from "react";
import MinutesCalc from "./MinutesCalc.jsx";
import CostCalc from "./CostCalc.jsx";
import NumbersFinder from "./NumbersFinder.jsx";
import { TabBar } from "../../design/ui.jsx";
import { C, T, TRACK, FONT_SANS, FONT_MONO } from "../../lib/tokens.js";

// Module 03 - Calculator hub. Three tabs over the shared canvas:
//   Minutes  - per-user calling time estimator
//   PAYG     - pay-as-you-go cost / quote estimator
//   Numbers  - country number finder (compliance, voice, pricing)
//
// Unlike every other module these are interactive tools rather than
// read-outs, so they keep their own internal layout and own their scroll. The
// hub only supplies the chrome: same canvas, same header grammar, same tabs.
const TABS = [
  { id: "minutes", label: "Minutes" },
  { id: "cost", label: "PAYG" },
  { id: "numbers", label: "Numbers" },
];

export default function CalculatorModule({ intent }) {
  const [tab, setTab] = useState(intent?.tab === "cost" ? "cost" : intent?.tab === "numbers" ? "numbers" : "minutes");
  useEffect(() => {
    if (intent?.tab && ["minutes", "cost", "numbers"].includes(intent.tab)) setTab(intent.tab);
  }, [intent]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bgGlow }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 18,
          padding: "16px 28px", flexShrink: 0,
          borderBottom: `1px solid ${C.divider}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: T.label, color: C.textFaint, letterSpacing: TRACK.label }}>
            03
          </span>
          <span
            style={{
              fontFamily: FONT_SANS, fontSize: T.bodyLg, fontWeight: 600,
              color: C.text, letterSpacing: TRACK.tight,
            }}
          >
            Calculator
          </span>
        </div>
        <TabBar tabs={TABS} value={tab} onChange={setTab} size="sm" cycleShortcut />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        {tab === "minutes" ? <MinutesCalc /> : tab === "cost" ? <CostCalc /> : <NumbersFinder />}
      </div>
    </div>
  );
}
