#!/usr/bin/env node
// SDR Pacing (module 05) data.js generator - Option A.
//
//   node scripts/gen-pacing.mjs <payload.json> [dataPath]
//
// Payload carries per-SDR actuals (SQL MRR + deals, SQO MRR + deals) pulled
// from HubSpot by the refresh runtime. The generator merges these with the
// roster/targets from src/pacing.config.js, computes working-day pacing, and
// writes through the refresh-core pipeline.
//
// Hand entry is eliminated: the refresh queries HubSpot for ALL SDR owner IDs
// in the roster, not just the current user's.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runGenerator, assertShape, readText, expectEqual } from "./lib/refresh-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../src/modules/pacing/data.js");

const HEADER = `// SDR Pacing - module 05 data.
// MACHINE-GENERATED each refresh by scripts/gen-pacing.mjs (Option A: Claude
// pulls per-SDR SQL/SQO from HubSpot, merges with roster config). The component
// (PacingModule) is never touched by a refresh.
`;

function reconcile(mod) {
  const P = mod.PACING;
  if (!P || typeof P !== "object") {
    throw new Error("PACING export missing or not an object");
  }

  // Required top-level keys
  for (const k of ["todayIso", "monthLabel", "roster", "actuals", "offices", "pool"]) {
    if (!(k in P)) throw new Error(`PACING missing required key "${k}"`);
  }

  // Roster is a non-empty array
  if (!Array.isArray(P.roster) || P.roster.length === 0) {
    throw new Error("roster must be a non-empty array");
  }

  // Every roster entry has required fields
  for (const [i, r] of P.roster.entries()) {
    for (const k of ["id", "name", "office", "sql", "sqo", "cal"]) {
      if (!(k in r)) throw new Error(`roster[${i}] missing "${k}"`);
    }
    if (!r.cal || typeof r.cal.total !== "number" || typeof r.cal.elapsed !== "number") {
      throw new Error(`roster[${i}] cal must have total, elapsed, left`);
    }
  }

  // Actuals keyed by owner ID
  if (typeof P.actuals !== "object") {
    throw new Error("actuals must be an object keyed by owner ID");
  }

  // Roll-ups: team SQL/SQO actuals must equal sum of individual actuals
  let teamSql = 0, teamSqo = 0, teamSqlDeals = 0, teamSqoDeals = 0;
  for (const id of Object.keys(P.actuals)) {
    const a = P.actuals[id];
    teamSql += a.sqlMrr || 0;
    teamSqo += a.sqoMrr || 0;
    teamSqlDeals += a.sqlDeals || 0;
    teamSqoDeals += a.sqoDeals || 0;
  }

  // Optional day-grain series for the cumulative curve. When present, every
  // entry must be shaped, and the series must re-add to the same totals as the
  // per-SDR actuals - two routes to one number, forced to agree.
  if (P.daily != null) {
    if (!Array.isArray(P.daily)) throw new Error("daily must be an array when present");
    let dSql = 0, dSqo = 0;
    for (const [i, d] of P.daily.entries()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || "")) {
        throw new Error(`daily[${i}].date must be YYYY-MM-DD`);
      }
      if (typeof d.sqlMrr !== "number" || typeof d.sqoMrr !== "number") {
        throw new Error(`daily[${i}] needs numeric sqlMrr and sqoMrr`);
      }
      dSql += d.sqlMrr; dSqo += d.sqoMrr;
    }
    if (Math.abs(dSql - teamSql) > 0.01) {
      throw new Error(`daily SQL sum ${dSql} != actuals sum ${teamSql}`);
    }
    if (Math.abs(dSqo - teamSqo) > 0.01) {
      throw new Error(`daily SQO sum ${dSqo} != actuals sum ${teamSqo}`);
    }
  }

  // Verify rollups if present
  if (P.rollups) {
    const t = P.rollups.team;
    if (t) {
      const sqlDiff = Math.abs(t.sqlMrr - teamSql);
      const sqoDiff = Math.abs(t.sqoMrr - teamSqo);
      if (sqlDiff > 0.01) throw new Error(`team SQL rollup ${t.sqlMrr} != sum ${teamSql}`);
      if (sqoDiff > 0.01) throw new Error(`team SQO rollup ${t.sqoMrr} != sum ${teamSqo}`);
    }
  }
}

async function main() {
  const [payloadPath, dataPath = DEFAULT_PATH] = process.argv.slice(2);
  if (!payloadPath) {
    console.error("usage: node scripts/gen-pacing.mjs <payload.json> [dataPath]");
    process.exit(1);
  }

  const raw = JSON.parse(await readText(payloadPath));

  assertShape(raw, {
    requiredKeys: ["todayIso", "monthLabel", "roster", "actuals", "offices", "pool"],
  }, "pacing");

  const exportList = [{ name: "PACING", value: raw }];

  await runGenerator({
    dataPath,
    header: HEADER,
    exports: exportList,
    reconcile,
  });

  console.log(`pacing/data.js written + reconciled (${dataPath}); ${raw.roster.length} SDRs.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
