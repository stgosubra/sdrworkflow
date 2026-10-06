#!/usr/bin/env node
// Performance (module 04) data.js generator - Option A.
//
//   node scripts/gen-performance.mjs <payload.json> [dataPath]
//
// Claude pulls all counts server-side via /hs (GROUP BY + COUNT/SUM - never row
// counts client-side, per the undercount memory), assembles the four data exports
// into <payload.json>, and runs this. The script does NOT fetch. It validates the
// shape, reconciles every YTD/total against the sum of its monthly parts, writes
// the file atomically, re-imports to prove it parses, and restores the backup if
// anything fails.
//
// Owned exports: PERFORMANCE, GEO_MONTHLY, MQL_GEO_MONTHLY, PROGRESSION_GEO.
// Metric definitions live in REFRESH_SPEC.md and the data.js header.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runGenerator, assertShape, expectEqual, sumBy, readText } from "./lib/refresh-core.mjs";
import { PROFILE, POINTS_QUOTA_PER_MONTH } from "../src/config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../src/modules/performance/data.js");

const HEADER = `// Performance metrics snapshot for ${PROFILE.name} (HubSpot ownerId ${PROFILE.ownerId}).
// Source of truth = HubSpot. MACHINE-GENERATED each refresh by
// scripts/gen-performance.mjs (Option A: Claude pulls via /hs, no stored token).
//
// Definitions (matched to the portal's saved SQL/SQO reports, deal-based):
//   SQL = deal_creator__sdr_only_ = ${PROFILE.ownerId}, bucketed by createdate.
//   SQO = + deal_accepted_by_ae = true.
//   points = deal_sdr_points_number (${POINTS_QUOTA_PER_MONTH}/mo = 100%),
//            credited in the month the deal is ACCEPTED (accepted_deal__date_time_).
//   AI deal = va_point >= 1. Won = dealstage 6607659.
//   seats tier (discovery_call__seats): micro 1-10, senior_micro 11-20, smb 21-50, mm 51-100, enterprise 101+.
//   MRR tier (amount__products_recurring): micro <=500, smb 500-1500, midmarket >=1500.
//   value = SUM(amount_in_home_currency) EUR. geo = deal-level country.
`;

const SEAT_TIERS = ["micro", "senior_micro", "smb", "mm", "enterprise"];
const SEG_TIERS = ["micro", "smb", "midmarket"];

function reconcile(mod) {
  const P = mod.PERFORMANCE;
  const months = P.funnelMonths;

  // acceptance YTD == sum of monthly buckets
  for (const k of ["accepted", "rejected", "pending"]) {
    expectEqual(`acceptanceYtd.${k}`, P.acceptanceYtd[k], sumBy(P.acceptanceByMonth, (r) => r[k]));
  }
  // SQO->Won YTD == sum of months
  for (const k of ["sqo", "won"]) {
    expectEqual(`sqoToWonYtd.${k}`, P.sqoToWonYtd[k], sumBy(P.sqoToWonByMonth, (r) => r[k]));
  }
  // funnel MQL ytd vs sum of monthly MQL: legitimately drifts. MQL ytd is its own
  // distinct-contact COUNT query, not a decomposition of the monthly buckets, so a
  // contact with no/late createdate month - or two counts pulled moments apart -
  // moves them apart. Not an error, so it must not abort the run.
  //
  // But it must not be a console.warn either. Nobody reads stdout on an unattended
  // run, so the drift was invisible in practice. Instead the payload must DECLARE
  // the drift as a number, checked for exactness here, which lands it in data.js
  // where src/lib/freshness.js reads it and the Shell renders it.
  {
    const ytd = P.funnel.mql.ytd;
    const parts = sumBy(months, (m) => P.funnel.mql[m]);
    expectEqual("mqlYtdDrift (declared vs funnel.mql.ytd - sum-of-months)", P.mqlYtdDrift, ytd - parts);
  }

  // funnel seats: each ytd tier metric == sum over months
  for (const tier of SEAT_TIERS) {
    for (const k of ["sql", "sqo", "rejected", "pending", "sqlValue", "sqoValue"]) {
      expectEqual(
        `funnel.seats.ytd.${tier}.${k}`,
        P.funnel.seats.ytd[tier][k],
        sumBy(months, (m) => P.funnel.seats[m][tier][k]),
      );
    }
  }
  // funnel AI: ai/core ytd == sum over months
  for (const kind of ["ai", "core"]) {
    for (const k of ["sql", "sqo", "rejected", "pending"]) {
      expectEqual(
        `funnel.ai.ytd.${kind}.${k}`,
        P.funnel.ai.ytd[kind][k],
        sumBy(months, (m) => P.funnel.ai[m][kind][k]),
      );
    }
  }
  // segmentSplit == sum of segmentMonthly (count + value, sql + sqo)
  for (const stage of ["sql", "sqo"]) {
    for (const tier of SEG_TIERS) {
      for (const k of ["count", "value"]) {
        expectEqual(
          `segmentSplit.${stage}.${tier}.${k}`,
          P.segmentSplit[stage][tier][k],
          sumBy(P.segmentMonthly, (r) => r[stage][tier][k]),
        );
      }
    }
  }
  // geo totals == sum of rows
  expectEqual("mqlGeoTotal.count", P.mqlGeoTotal.count, sumBy(P.mqlGeo, (r) => r.count));
  expectEqual("geoTotal.count", P.geoTotal.count, sumBy(P.geo, (r) => r.count));
  expectEqual("geoTotal.value", P.geoTotal.value, sumBy(P.geo, (r) => r.value));

  // progression rows cover the funnel months
  expectEqual("progression.length", P.progression.length, months.length);

  // byCountry matrix: every country has one row per funnel month
  const bc = mod.PROGRESSION_GEO.byCountry;
  for (const c of Object.keys(bc)) {
    expectEqual(`PROGRESSION_GEO.byCountry.${c}.length`, bc[c].length, months.length);
  }
}

async function main() {
  const [payloadPath, dataPath = DEFAULT_PATH] = process.argv.slice(2);
  if (!payloadPath) {
    console.error("usage: node scripts/gen-performance.mjs <payload.json> [dataPath]");
    process.exit(1);
  }
  const payload = JSON.parse(await readText(payloadPath));

  assertShape(payload, {
    requiredKeys: ["PERFORMANCE", "GEO_MONTHLY", "MQL_GEO_MONTHLY", "PROGRESSION_GEO"],
  });
  assertShape(payload.PERFORMANCE, {
    requiredKeys: [
      "owner", "ownerId", "currency", "refreshedAt", "weekLabel", "monthLabel",
      "pacing", "points", "acceptance", "acceptanceByMonth", "acceptanceYtd",
      "sqoToWonByMonth", "sqoToWonYtd", "stalls", "closed", "funnelMonths", "funnel",
      "metrics", "mqlToSql", "progression", "rejectedByOwner", "mqlGeo", "mqlGeoTotal",
      "segmentSplit", "segmentMonthly", "geo", "geoTotal",
      // Declared-drift + declared-gap channels. Both must be present even when
      // empty/zero, so "no gaps" is an explicit statement rather than an omission.
      "mqlYtdDrift", "dataGaps",
    ],
    nonEmptyArrays: ["points", "acceptanceByMonth", "sqoToWonByMonth", "funnelMonths", "geo"],
  }, "PERFORMANCE");

  // dataGaps may be empty but must be an array of strings; mqlYtdDrift must be a
  // number. Checked before the write so a malformed declaration never reaches disk.
  if (!Array.isArray(payload.PERFORMANCE.dataGaps) ||
      payload.PERFORMANCE.dataGaps.some((g) => typeof g !== "string")) {
    throw new Error("PERFORMANCE.dataGaps: must be an array of strings (empty is fine)");
  }
  if (typeof payload.PERFORMANCE.mqlYtdDrift !== "number") {
    throw new Error("PERFORMANCE.mqlYtdDrift: must be a number (0 when the counts agree)");
  }

  await runGenerator({
    dataPath,
    header: HEADER,
    exports: [
      { name: "PERFORMANCE", value: payload.PERFORMANCE },
      { name: "GEO_MONTHLY", value: payload.GEO_MONTHLY },
      { name: "MQL_GEO_MONTHLY", value: payload.MQL_GEO_MONTHLY },
      { name: "PROGRESSION_GEO", value: payload.PROGRESSION_GEO },
    ],
    reconcile,
  });
  console.log(`performance/data.js written + reconciled (${dataPath}).`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
