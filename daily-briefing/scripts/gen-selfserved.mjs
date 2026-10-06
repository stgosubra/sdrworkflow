#!/usr/bin/env node
// Self-Served (module 04) data.js generator - Option A.
//
//   node scripts/gen-selfserved.mjs <payload.json> [dataPath]
//
// Claude pulls the rolling-90-day cohort via /hs + per-contact deal-association
// checks, scores and sorts the items, and assembles the SELFSERVED export into
// <payload.json>. This script does NOT fetch. It validates the funnel decomposition,
// re-derives every rank_score, asserts the sort order, writes atomically, re-imports
// to prove it parses, and restores the backup on any failure. The onboarding-alert
// helpers are preserved verbatim as a static code tail (not regenerated).
//
// Owned data export: SELFSERVED. Preserved code: ONBOARD_MIN/MAX_DAYS + helpers.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runGenerator, assertShape, expectEqual, sumBy, readText } from "./lib/refresh-core.mjs";
import { PROFILE, PORTAL_ID } from "../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../src/modules/selfserved/data.js");

const HEADER = `// Self-Served Tracker - live pull for ${PROFILE.name} (HubSpot ownerId ${PROFILE.ownerId}).
// Source of truth = HubSpot, portal ${PORTAL_ID}. MACHINE-GENERATED each refresh by
// scripts/gen-selfserved.mjs (Option A: Claude pulls via /hs, no stored token).
//
// Cohort (all must hold):
//   - hubspot_owner_id = ${PROFILE.ownerId}
//   - hs_lead_status NOT IN ('Qualified', 'ATTEMPTED_TO_CONTACT') - the latter means
//     "Qualified Out" in this account's lead-status model and is excluded like Qualified.
//   - account_became_active within the rolling 90-day window
//   - contact has zero OPEN and zero CLOSED-WON deals (closed-lost -> RE-ENGAGE)
// Eligibility judged on contact-level deal association (associations.DEAL).
//
// Ranking: rank_score = round(seat*0.40 + geo*0.35 + source*0.25); tier->score
// T1=100, T2=66, T3=33. Sorted desc, ties by account_became_active desc.
`;

// Static code tail - preserved verbatim across refreshes (logic, not data).
const STATIC_TAIL = `// Onboarding / upsell alert rule (shared by the module and the shell nav badge).
// Fires for a self-served account whose activation is "fresh but past first-touch":
// strictly older than 3 days AND strictly younger than 30 days since account_became_active.
export const ONBOARD_MIN_DAYS = 3;
export const ONBOARD_MAX_DAYS = 30;

function ageInDays(iso, today) {
  if (!iso) return null;
  const a = new Date(iso);
  const t = new Date(today);
  if (isNaN(a) || isNaN(t)) return null;
  return Math.floor((t - a) / 86400000);
}

export function isOnboardingAlert(item, today = SELFSERVED.today) {
  if (!item || !item.self_served) return false;
  const age = ageInDays(item.account_became_active, today);
  return age != null && age > ONBOARD_MIN_DAYS && age < ONBOARD_MAX_DAYS;
}

export function onboardingAlertCount(today = SELFSERVED.today) {
  return SELFSERVED.items.filter((it) => isOnboardingAlert(it, today)).length;
}
`;

const TIER_SCORE = { T1: 100, T2: 66, T3: 33 };

function reconcile(mod) {
  const S = mod.SELFSERVED;
  const f = S.funnel;

  // funnel decomposition (totals == sum of parts)
  expectEqual("funnel.nonQualified", f.nonQualified, f.activeInWindow - f.qualified);
  expectEqual("funnel.eligible", f.eligible, f.noDeal + f.closedLostReengage);
  // nonQualified must fully decompose: disqualified-by-deal + eligible. Without this
  // a pull that undercounts disqualifiedByDeal (or eligible) still passes every other
  // check while silently dropping contacts from the funnel.
  expectEqual("funnel.nonQualified decomp", f.disqualifiedByDeal + f.eligible, f.nonQualified);
  expectEqual("items.length == eligible", S.items.length, f.eligible);

  // closed-lost re-engage count matches flagged items
  expectEqual(
    "funnel.closedLostReengage",
    f.closedLostReengage,
    S.items.filter((it) => it.closedLostFlag === true).length,
  );

  // notEligible mirrors the funnel exclusions
  expectEqual("notEligible.qualifiedCount", S.notEligible.qualifiedCount, f.qualified);
  expectEqual("notEligible.wonDeal.length", S.notEligible.wonDeal.length, f.disqualifiedByDeal);

  // every rank_score re-derives from the tier weights
  const w = S.weights;
  for (const it of S.items) {
    const want = Math.round(
      TIER_SCORE[it.seat_tier] * w.seat +
      TIER_SCORE[it.geo_tier] * w.geo +
      TIER_SCORE[it.source_tier] * w.source,
    );
    expectEqual(`rank_score ${it.hsObjectId}`, it.rank_score, want);
  }

  // sort order: rank_score desc, ties by account_became_active desc
  for (let i = 1; i < S.items.length; i++) {
    const prev = S.items[i - 1], cur = S.items[i];
    if (cur.rank_score > prev.rank_score) {
      throw new Error(`sort: item ${i} score ${cur.rank_score} > prev ${prev.rank_score}`);
    }
    if (cur.rank_score === prev.rank_score &&
        (cur.account_became_active || "") > (prev.account_became_active || "")) {
      throw new Error(`sort tie: item ${i} activation ${cur.account_became_active} newer than prev ${prev.account_became_active}`);
    }
  }
}

async function main() {
  const [payloadPath, dataPath = DEFAULT_PATH] = process.argv.slice(2);
  if (!payloadPath) {
    console.error("usage: node scripts/gen-selfserved.mjs <payload.json> [dataPath]");
    process.exit(1);
  }
  const payload = JSON.parse(await readText(payloadPath));
  assertShape(payload, { requiredKeys: ["SELFSERVED"] });
  assertShape(payload.SELFSERVED, {
    requiredKeys: [
      "owner", "ownerId", "portalId", "refreshedAt", "today",
      "windowStart", "windowEnd", "windowDays", "weights", "funnel", "items", "notEligible",
    ],
    nonEmptyArrays: ["items"],
  }, "SELFSERVED");

  await runGenerator({
    dataPath,
    header: HEADER,
    exports: [{ name: "SELFSERVED", value: payload.SELFSERVED }],
    staticTail: STATIC_TAIL,
    expectedExports: ["SELFSERVED", "ONBOARD_MIN_DAYS", "ONBOARD_MAX_DAYS", "isOnboardingAlert", "onboardingAlertCount"],
    reconcile,
  });
  console.log(`selfserved/data.js written + reconciled (${dataPath}).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
