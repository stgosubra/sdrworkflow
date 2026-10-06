#!/usr/bin/env node
// Briefing (module 01) data.js generator - Option A.
//
//   node scripts/gen-briefing.mjs <payload.json> [dataPath]
//
// Module 01 has no value unless all THREE sources are joined for the present day:
//   - Calendar (browser): today's events -> prospect cards + other events
//   - HubSpot (MCP):      per-attendee contact enrichment
//   - Gmail (browser):    last thread per attendee -> lastEmail (best-effort)
// There are no standing credentials, so Claude does the live pull at refresh time
// and this script only serializes + validates. To make "the pull actually happened"
// enforceable, the payload carries a non-persisted `_refresh.sources` assertion:
// the gate HARD-FAILS if calendar or hubspot was not pulled, and warns if gmail
// was skipped. `_refresh` is stripped before writing - it never lands in data.js.
//
// The refresh regenerates today's slice (TODAY_ISO/LABEL, REFRESHED_AT, WEEK_DAYS,
// WEEK_PROSPECTS[TODAY]/WEEK_OTHER_EVENTS[TODAY]) and the today day-array. Historical
// week arrays are frozen and carried forward unchanged by the caller. Date scaffolding
// is checked against src/lib/dates.js so a refresh can't desync the week from TODAY.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runGenerator, assertShape, readText } from "./lib/refresh-core.mjs";
import { weekDays, longLabel, isoFor } from "../src/lib/dates.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../src/modules/briefing/data.js");

const HEADER = `// Daily Brief - module 01 (Today / Schedule) data.
// MACHINE-GENERATED each refresh by scripts/gen-briefing.mjs (Option A: Claude joins
// Calendar + HubSpot + Gmail for the present day, no stored token). The component
// (BriefingModule.jsx) is never touched by a refresh.
//
// Each refresh regenerates today's slice: TODAY_ISO, TODAY_LABEL, REFRESHED_AT,
// WEEK_DAYS (Mon-Fri), and WEEK_PROSPECTS[TODAY] / WEEK_OTHER_EVENTS[TODAY].
// Historical week arrays are frozen history, carried forward unchanged.
// Prospect-card prose (companyBrief, challengerInsight, qualifierQuestions) is
// regenerated from the freshly pulled facts each run; lastEmail is null when Gmail
// is unreachable (the card render guards on null). PII (names/emails/phones) lives
// here for the LOCAL dashboard only - never logged, transmitted, or stored.
`;

// Keys every TODAY prospect card must carry (proves the Calendar x HubSpot join ran).
const TODAY_CARD_KEYS = [
  "name", "email", "start", "end", "hsLink", "meetLink", "canceled", "rsvp",
  "company", "companyUrl", "jobtitle", "country", "leadStatus", "leadSource",
  "deals", "seats", "phone", "multiAttendee",
  "companyBrief", "challengerInsight", "qualifierQuestions", "lastEmail",
  "lusha",
];

function reconcile(mod, meta) {
  // 1. Source contract - the whole point of module 01.
  const src = meta.sources || {};
  if (!src.calendar || !src.hubspot) {
    throw new Error(`module 01 needs Calendar + HubSpot pulled (got calendar=${!!src.calendar}, hubspot=${!!src.hubspot}); a brief without both has no value`);
  }
  if (!src.gmail) console.warn("warn gmail not pulled this run - lastEmail will be null on today's cards (allowed)");

  const E = mod;
  const today = E.TODAY_ISO;

  // 2. Date scaffolding ties back to the Step-3 util (no week/today desync).
  if (isoFor(today) !== today) throw new Error(`TODAY_ISO "${today}" is not a valid ISO date`);
  if (E.TODAY_LABEL !== longLabel(today)) {
    throw new Error(`TODAY_LABEL "${E.TODAY_LABEL}" != longLabel(${today}) "${longLabel(today)}"`);
  }
  const wd = weekDays(today);
  if (JSON.stringify(E.WEEK_DAYS) !== JSON.stringify(wd)) {
    throw new Error("WEEK_DAYS does not match weekDays(TODAY_ISO) from src/lib/dates.js");
  }

  // 3. WEEK_PROSPECTS / WEEK_OTHER_EVENTS keyed by exactly the week days weekDays()
  //    returns (Mon-Fri). Derived, not a literal, so narrowing the week in dates.js
  //    tightens this gate with it instead of leaving a stale count behind.
  const weekIsos = wd.map((d) => d.iso);
  for (const mapName of ["WEEK_PROSPECTS", "WEEK_OTHER_EVENTS"]) {
    const keys = Object.keys(E[mapName]).sort();
    if (JSON.stringify(keys) !== JSON.stringify([...weekIsos].sort())) {
      throw new Error(`${mapName} keys ${keys.join(",")} != week days ${weekIsos.join(",")}`);
    }
  }
  if (!Array.isArray(E.WEEK_PROSPECTS[today])) {
    throw new Error(`WEEK_PROSPECTS["${today}"] missing - today's pull did not land`);
  }

  // 4. Every TODAY card is fully enriched (HubSpot fields + regenerated prose).
  //    An empty today is allowed (a day with no external meetings); a half-built
  //    card is not.
  E.WEEK_PROSPECTS[today].forEach((card, i) => {
    for (const k of TODAY_CARD_KEYS) {
      if (!(k in card)) throw new Error(`today card[${i}] missing "${k}"`);
    }
    if (typeof card.companyBrief !== "string" || !card.companyBrief.trim()) {
      throw new Error(`today card[${i}] companyBrief empty - prose not regenerated`);
    }
    if (typeof card.challengerInsight !== "string" || !card.challengerInsight.trim()) {
      throw new Error(`today card[${i}] challengerInsight empty - prose not regenerated`);
    }
    if (!Array.isArray(card.qualifierQuestions) || card.qualifierQuestions.length === 0) {
      throw new Error(`today card[${i}] qualifierQuestions empty - prose not regenerated`);
    }
    // every today-card must have at least 5 fully-formed questions with why fields;
    // shallow discovery questions are a build failure, not a style preference
    if (card.qualifierQuestions.length < 5) {
      throw new Error(`today card[${i}] has only ${card.qualifierQuestions.length} qualifier questions - minimum 5 required; a call with fewer than 5 specific, vetted questions is under-prepared`);
    }
    card.qualifierQuestions.forEach((q, qi) => {
      for (const field of ["key", "label", "hint", "why"]) {
        if (typeof q[field] !== "string" || !q[field].trim()) {
          throw new Error(`today card[${i}] qualifierQuestions[${qi}] missing or empty "${field}" - every question must have key, label, hint, and why; missing why means the caller does not know what to listen for`);
        }
      }
    });
  });
}

// Flatten a WEEK_PROSPECTS-shaped map ({ iso: [card, ...] }) into the flat,
// meetingIso-tagged array shape the "re-engage" tab (LAST_WEEK_PROSPECTS /
// TWO_WEEKS_AGO_PROSPECTS) expects.
function flattenWeekProspects(weekProspects) {
  const out = [];
  for (const iso of Object.keys(weekProspects || {})) {
    for (const card of weekProspects[iso] || []) out.push({ ...card, meetingIso: iso });
  }
  return out;
}

// The generator owns the week-over-week history rollover so a refresh payload
// can never silently drop it again (this is what broke on 2026-07-27: the
// payload only carried the fresh week, and the caller-supplied LAST_WEEK/
// TWO_WEEKS_AGO history it should have carried forward was lost with no way
// back - no git history, no backup survives a successful write). On a genuine
// new week (Monday of WEEK_DAYS changes) the outgoing WEEK_PROSPECTS becomes
// LAST_WEEK_PROSPECTS and the outgoing LAST_WEEK_PROSPECTS becomes
// TWO_WEEKS_AGO_PROSPECTS. On an intraweek refresh (same Monday) the existing
// history is carried forward untouched, ignoring anything the payload sends.
async function rollHistory(dataPath, newWeekDays) {
  const empty = { LAST_WEEK_PROSPECTS: [], TWO_WEEKS_AGO_PROSPECTS: [] };
  if (!existsSync(dataPath)) return empty;
  let old;
  try {
    old = await import(`${resolve(dataPath)}?t=${Date.now()}`);
  } catch {
    return empty; // unreadable/corrupt predecessor - don't block a fresh write on it
  }
  const oldMonday = old.WEEK_DAYS?.[0]?.iso;
  const newMonday = newWeekDays?.[0]?.iso;
  if (!oldMonday || oldMonday === newMonday) {
    return {
      LAST_WEEK_PROSPECTS: old.LAST_WEEK_PROSPECTS || [],
      TWO_WEEKS_AGO_PROSPECTS: old.TWO_WEEKS_AGO_PROSPECTS || [],
    };
  }
  return {
    LAST_WEEK_PROSPECTS: flattenWeekProspects(old.WEEK_PROSPECTS),
    TWO_WEEKS_AGO_PROSPECTS: old.LAST_WEEK_PROSPECTS || [],
  };
}

async function main() {
  const [payloadPath, dataPath = DEFAULT_PATH] = process.argv.slice(2);
  if (!payloadPath) {
    console.error("usage: node scripts/gen-briefing.mjs <payload.json> [dataPath]");
    process.exit(1);
  }
  const raw = JSON.parse(await readText(payloadPath));
  const meta = raw._refresh || {};
  const { _refresh, ...exportsObj } = raw; // _refresh is never persisted to data.js

  assertShape(exportsObj, {
    requiredKeys: ["TODAY_ISO", "TODAY_LABEL", "REFRESHED_AT", "WEEK_DAYS", "WEEK_PROSPECTS", "WEEK_OTHER_EVENTS"],
    nonEmptyArrays: ["WEEK_DAYS"],
  }, "briefing");

  const history = await rollHistory(dataPath, exportsObj.WEEK_DAYS);
  exportsObj.LAST_WEEK_PROSPECTS = history.LAST_WEEK_PROSPECTS;
  exportsObj.TWO_WEEKS_AGO_PROSPECTS = history.TWO_WEEKS_AGO_PROSPECTS;

  const exportList = Object.keys(exportsObj).map((name) => ({ name, value: exportsObj[name] }));

  await runGenerator({
    dataPath,
    header: HEADER,
    exports: exportList,
    reconcile: (mod) => reconcile(mod, meta),
  });
  console.log(`briefing/data.js written + reconciled (${dataPath}); ${exportList.length} exports.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
