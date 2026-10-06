#!/usr/bin/env node
// Copy the committed templates into place for anything missing:
//   src/config.example.js       -> src/config.js
//   src/modules/*/data.seed.js  -> src/modules/*/data.js
//
// Runs automatically via npm postinstall, and is safe to run by hand at any
// time. NEVER overwrites an existing data.js - a real refreshed data.js is
// irreplaceable (it is gitignored, so there is no copy anywhere) and clobbering
// it with an empty seed would destroy that morning's pull with no way back.
// Absent-only, always.

import { existsSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MODULES = ["briefing", "performance", "selfserved", "pacing", "deals"];

// config.js is gitignored so it never carries a real name or owner id into the
// repo. Same absent-only rule: an existing one holds the operator's answers.
const config = resolve(ROOT, "src/config.js");
if (!existsSync(config)) {
  await copyFile(resolve(ROOT, "src/config.example.js"), config);
  console.log("created src/config.js from the template - fill in PROFILE");
}

let seeded = 0;
for (const mod of MODULES) {
  const data = resolve(ROOT, `src/modules/${mod}/data.js`);
  const seed = resolve(ROOT, `src/modules/${mod}/data.seed.js`);
  if (existsSync(data)) continue;
  if (!existsSync(seed)) {
    console.error(`seed missing for ${mod} - run: node scripts/make-seeds.mjs`);
    process.exit(1);
  }
  await copyFile(seed, data);
  console.log(`seeded src/modules/${mod}/data.js from seed (empty - refresh to populate)`);
  seeded++;
}

if (seeded) {
  console.log(`\n${seeded} module(s) seeded empty. The dashboard will build and show`);
  console.log(`every module as STALE until the first refresh runs.`);
}
