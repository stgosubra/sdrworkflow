#!/usr/bin/env node
// Deals (module 07) data.js generator.
//
//   node scripts/gen-deals.mjs <payload.json> [dataPath]
//
// Cohort: every deal created in the current calendar month where the current user
// is `deal_creator__sdr_only_`. The module tracks what the AEs then did with them,
// so the payload carries the outcome per deal and the clock that outcome is
// racing - see REFRESH_SPEC.md module 07 for the pull.
//
// The generator validates shape and writes through refresh-core.

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { runGenerator, assertShape, readText } from "./lib/refresh-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, "../src/modules/deals/data.js");

const HEADER = `// Deals - module 07 data.
// MACHINE-GENERATED each refresh by scripts/gen-deals.mjs. The component
// (DealsModule) is never touched by a refresh.
`;

const VALID_SEGS = new Set(["micro", "smb", "mm", "none"]);
const VALID_NS = new Set(["ok", "noshow", "rescheduled"]);
const VALID_OUTCOMES = new Set(["upcoming", "pending", "accepted", "rejected"]);

function reconcile(mod) {
  const D = mod.DEALS;
  if (!D || typeof D !== "object") {
    throw new Error("DEALS export missing or not an object");
  }

  for (const k of ["todayIso", "monthLabel", "monthStart", "slaHours", "target", "pointsQuota", "deals"]) {
    if (!(k in D)) throw new Error(`DEALS missing required key "${k}"`);
  }

  if (!Array.isArray(D.deals)) throw new Error("deals must be an array");
  if (typeof D.slaHours !== "number" || D.slaHours <= 0) {
    throw new Error("slaHours must be a positive number");
  }

  for (const [i, d] of D.deals.entries()) {
    for (const k of ["id", "name", "ae", "amt", "pts", "seg", "ns", "outcome", "created", "demoAt", "ageH"]) {
      if (!(k in d)) throw new Error(`deals[${i}] missing "${k}"`);
    }
    if (!VALID_SEGS.has(d.seg)) throw new Error(`deals[${i}] invalid seg "${d.seg}"`);
    if (!VALID_NS.has(d.ns)) throw new Error(`deals[${i}] invalid ns "${d.ns}"`);
    if (!VALID_OUTCOMES.has(d.outcome)) {
      throw new Error(`deals[${i}] invalid outcome "${d.outcome}"`);
    }
    // An upcoming deal is upcoming *because* a demo is booked in the future.
    // Without a demoAt the classification is unprovable, so reject it rather
    // than let a column fill with deals that merely have no outcome yet.
    if (d.outcome === "upcoming" && !d.demoAt) {
      throw new Error(`deals[${i}] outcome "upcoming" requires demoAt`);
    }
  }

  // Breach is derived here and in the component, never carried on the payload -
  // a stored `breaching` flag is a second source of truth that goes wrong the
  // moment the clock moves past it.
  const breaching = D.deals.filter((d) => d.outcome === "pending" && d.ageH > D.slaHours);
  console.log(`  ${D.deals.length} deals, ${breaching.length} past the ${D.slaHours}h AE SLA`);
}

async function main() {
  const [payloadPath, dataPath = DEFAULT_PATH] = process.argv.slice(2);
  if (!payloadPath) {
    console.error("usage: node scripts/gen-deals.mjs <payload.json> [dataPath]");
    process.exit(1);
  }

  const raw = JSON.parse(await readText(payloadPath));

  assertShape(raw, {
    requiredKeys: ["todayIso", "monthLabel", "monthStart", "slaHours", "target", "pointsQuota", "deals"],
  }, "deals");

  await runGenerator({
    dataPath,
    header: HEADER,
    exports: [{ name: "DEALS", value: raw }],
    reconcile,
  });

  console.log(`deals/data.js written + reconciled (${dataPath}); ${raw.deals.length} deals.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
