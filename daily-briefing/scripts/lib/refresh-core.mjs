// Shared refresh core for the Option A (agent-orchestrated) data.js generators.
//
// In Option A there are NO standing credentials and NO unattended fetch. Claude,
// in-session, does the live pull (HubSpot via /hs MCP, Calendar/Gmail via browser),
// assembles the module's data exports as a plain JS value, and hands them here.
// This module owns only the deterministic, error-prone-by-hand tail of a refresh:
//
//   clean-check -> back up -> serialize -> atomic write -> re-import (parse proof)
//   -> module-specific reconciliation -> restore-on-failure.
//
// Nothing here pulls data or talks to a network. It is pure local file work so a
// refresh can never leave a module half-written: if any gate throws, the prior
// data.js is restored from its backup before the error propagates.

import { readFile, writeFile, copyFile, rename, unlink } from "node:fs/promises";

// ── serialization ─────────────────────────────────────────────────────────────
// Data exports hold only JSON-shaped values (strings, numbers, booleans, null,
// arrays, plain objects) - the live render values, already resolved (e.g. an
// hsLink is the final URL string, not an HS(id) call). JSON 2-space output is
// valid JS and diff-friendly; quoted keys like "2026-01" are required anyway.
export function serializeExport(name, value) {
  return `export const ${name} = ${JSON.stringify(value, null, 2)};\n`;
}

// ── payload hygiene ─────────────────────────────────────────────────────────
// Reject undefined / NaN / Infinity anywhere in a payload BEFORE serializing -
// JSON.stringify silently drops undefined in objects and would corrupt the shape.
export function assertClean(label, value, path = label) {
  if (value === undefined) throw new Error(`${path}: undefined (not serializable)`);
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error(`${path}: ${value} (NaN/Infinity)`);
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertClean(label, v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const k of Object.keys(value)) assertClean(label, value[k], `${path}.${k}`);
  }
}

// ── shape check ───────────────────────────────────────────────────────────────
// Confirm required top-level keys exist and named arrays are non-degenerate.
export function assertShape(obj, { requiredKeys = [], nonEmptyArrays = [] }, label = "payload") {
  for (const k of requiredKeys) {
    if (!(k in obj)) throw new Error(`${label}: missing required key "${k}"`);
  }
  for (const k of nonEmptyArrays) {
    if (!Array.isArray(obj[k]) || obj[k].length === 0) {
      throw new Error(`${label}: "${k}" must be a non-empty array`);
    }
  }
}

// ── reconciliation helpers ──────────────────────────────────────────────────
export function expectEqual(label, got, want) {
  if (got !== want) throw new Error(`reconcile ${label}: got ${got}, expected ${want}`);
}
export function sumBy(rows, fn) {
  return rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
}

// ── file I/O (backup / atomic write / restore) ──────────────────────────────
export async function backup(path) {
  const bak = `${path}.bak`;
  await copyFile(path, bak);
  return bak;
}
export async function restore(path) {
  await copyFile(`${path}.bak`, path);
}
async function writeAtomic(path, text) {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, text, "utf8");
  await rename(tmp, path);
}

// Re-import with a cache-busting query so we read what we just wrote, then confirm
// every expected export is present. Returns the fresh module namespace.
export async function verifyImport(path, expectedExports = []) {
  const mod = await import(`${path}?t=${Date.now()}`);
  for (const name of expectedExports) {
    if (!(name in mod)) throw new Error(`written file missing export "${name}"`);
  }
  return mod;
}

// ── orchestrator ──────────────────────────────────────────────────────────────
// runGenerator wires the full gate. `exports` is an ordered [{name, value}] of the
// DATA exports to (re)write; `staticTail` is verbatim code preserved after them
// (e.g. helper functions). `reconcile(mod)` runs against the freshly imported
// module and must throw on any mismatch. On ANY failure the backup is restored.
// Every generated file also gets a GENERATED_AT stamp. It is taken from the write
// itself rather than the payload, so it cannot drift or be forgotten: the app reads
// it (see src/lib/freshness.js) to warn when a module's data is not from today.
export async function runGenerator({
  dataPath,
  header = "",
  exports: dataExports,
  staticTail = "",
  expectedExports = dataExports.map((e) => e.name),
  reconcile = () => {},
}) {
  for (const { name, value } of dataExports) assertClean(name, value);

  const bak = await backup(dataPath);
  try {
    const stamp = serializeExport("GENERATED_AT", new Date().toISOString());
    const body = [stamp, ...dataExports.map((e) => serializeExport(e.name, e.value))].join("\n");
    const file = `${header}${header.endsWith("\n") || !header ? "" : "\n"}${body}${staticTail ? `\n${staticTail}` : ""}`;
    await writeAtomic(dataPath, file);
    const mod = await verifyImport(dataPath, ["GENERATED_AT", ...expectedExports]);
    await reconcile(mod);
    await unlink(bak).catch(() => {});
    return { ok: true };
  } catch (err) {
    await restore(dataPath);
    throw new Error(`refresh aborted, ${dataPath} restored from backup: ${err.message}`);
  }
}

export async function readText(path) {
  return readFile(path, "utf8");
}
