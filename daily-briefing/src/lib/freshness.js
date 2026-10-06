// Data freshness for the three generator-backed modules.
//
// Every data.js written by scripts/lib/refresh-core.mjs carries a GENERATED_AT
// ISO stamp taken at write time. The unattended refresh (briefing-daily task) is
// best-effort - it fires on machine wake, so a missed morning is possible and
// must be visible rather than silent. Shell renders a banner from staleModules().
//
// Namespace imports, not named ones: a data.js generated before the stamp existed
// simply has no GENERATED_AT, and a namespace read yields undefined instead of a
// build error.

import * as briefingData from "../modules/briefing/data.js";
import * as performanceData from "../modules/performance/data.js";
import * as selfservedData from "../modules/selfserved/data.js";
import * as pacingData from "../modules/pacing/data.js";
import * as dealsData from "../modules/deals/data.js";

const SOURCES = [
  { id: "briefing",    num: "02", label: "Today",       stamp: briefingData.GENERATED_AT },
  { id: "performance", num: "04", label: "Performance", stamp: performanceData.GENERATED_AT },
  { id: "selfserved",  num: "05", label: "Self-Served", stamp: selfservedData.GENERATED_AT },
  { id: "pacing",      num: "06", label: "SDR Pacing",  stamp: pacingData.GENERATED_AT },
  { id: "deals",       num: "07", label: "Pipeline",    stamp: dealsData.GENERATED_AT },
];

function localDayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Whole days between the stamp's local date and today's. 0 = refreshed today.
function daysStale(stamp, now) {
  const then = new Date(stamp);
  if (isNaN(then)) return null;
  const a = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86400000);
}

// Modules whose data is not from today. An absent stamp counts as stale with
// days: null - it means the file predates the stamp, so freshness is unknown and
// silently claiming it is current would be worse than flagging it.
export function staleModules(now = new Date()) {
  return SOURCES.filter((s) => {
    if (!s.stamp) return true;
    return daysStale(s.stamp, now) !== 0;
  }).map((s) => ({ ...s, days: s.stamp ? daysStale(s.stamp, now) : null }));
}

// Gaps a refresh declared rather than filled. The guardrail is "declare gaps, do
// not invent values", which only works if a declared gap is actually seen - and
// generator stdout is not seen on an unattended run. So the payload carries them
// and they surface in the Shell.
//
// Optional chaining throughout: a data.js written before these fields existed
// yields undefined and contributes nothing, rather than crashing the app.
export function declaredGaps() {
  const out = [];
  const perf = performanceData.PERFORMANCE;

  for (const g of perf?.dataGaps ?? []) {
    out.push({ num: "04", label: "Performance", text: g });
  }
  // MQL YTD is an independent distinct-contact COUNT, not a sum of the monthly
  // buckets, so a small drift is expected rather than a bug. Worth seeing, not
  // worth blocking - which is why the generator checks it is declared exactly and
  // then lets the run through.
  if (typeof perf?.mqlYtdDrift === "number" && perf.mqlYtdDrift !== 0) {
    const d = perf.mqlYtdDrift;
    out.push({
      num: "04",
      label: "Performance",
      text: `MQL YTD is ${d > 0 ? `${d} above` : `${Math.abs(d)} below`} the sum of its monthly buckets (independent COUNTs, expected drift)`,
    });
  }
  return out;
}

export function freshnessFor(id, now = new Date()) {
  const src = SOURCES.find((s) => s.id === id);
  if (!src) return null;
  return {
    ...src,
    days: src.stamp ? daysStale(src.stamp, now) : null,
    today: Boolean(src.stamp) && daysStale(src.stamp, now) === 0,
    dayKey: src.stamp ? localDayKey(new Date(src.stamp)) : null,
  };
}
