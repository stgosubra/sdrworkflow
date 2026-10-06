import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { enrich } from './score.mjs';
import { embedSnapshot, injectShared } from './embed.mjs';
import { historyEntry, diffRuns } from './history.mjs';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const FREE_DOMAINS = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','msn.com','aol.com','icloud.com','me.com','mac.com','proton.me','protonmail.com','mail.com','mail.ru','yandex.ru','gmx.com','zoho.com','qq.com','163.com','126.com','web.de','laposte.net','orange.fr','free.fr','sfr.fr','wanadoo.fr','personal.com']);

function validate(enriched){
  // Note: a qualCallDate without a Modjo note is a normal "booked but not held/logged" state.
  // Scoring already handles it (hasQual requires both), so we do NOT abort on it.
  // Note: null seatBand is legitimate (HubSpot field blank); score.mjs handles it with || 0.
  const warn = [];
  for(const c of enriched){
    if(c.seatBand == null) warn.push(c.id);
  }
  if(warn.length) console.warn(`[validate] null seatBand on ${warn.length} contact(s): ${warn.join(', ')} — scoring as 0 pts`);
}

export function runRefresh(paths){
  const raw = JSON.parse(readFileSync(paths.raw));
  const now = new Date(raw.snapshotDate).getTime();
  const enriched = enrich(raw.contacts, { now, freeDomains: FREE_DOMAINS });
  validate(enriched);

  const snapshot = { ...raw, contacts: enriched };

  // backup previous snapshot before overwrite
  if(existsSync(paths.snapshot)) copyFileSync(paths.snapshot, paths.snapshot + '.bak');

  // single-source injection (tier + copy) then embed snapshot data
  let html = readFileSync(paths.html, 'utf8');
  html = injectShared(html, {
    scoreSrc: readFileSync(paths.score, 'utf8'),
    copySrc: readFileSync(paths.copy, 'utf8')
  });
  writeFileSync(paths.html, embedSnapshot(html, snapshot));

  // snapshot file
  writeFileSync(paths.snapshot, JSON.stringify(snapshot, null, 2));

  // history + diff
  let history = [];
  if(existsSync(paths.history)){ try { history = JSON.parse(readFileSync(paths.history)); } catch { history = []; } }
  const prev = history.length ? history[history.length - 1].contacts : null;
  const diff = diffRuns(prev, enriched.map(c => ({ id: c.id, segment: c.segment, staleDays: c.staleDays })));
  history.push(historyEntry(raw.snapshotDate, enriched));
  writeFileSync(paths.history, JSON.stringify(history, null, 2));
  writeFileSync(paths.diff, JSON.stringify(diff, null, 2));

  return { count: enriched.length, diff };
}

// CLI entry: node tools/refresh.mjs
if(import.meta.url === pathToFileURL(process.argv[1]).href){
  const root = fileURLToPath(new URL('../', import.meta.url));
  const res = runRefresh({
    raw: root + 'stale-lead-raw-pull.json',
    snapshot: root + 'stale-lead-tracker-snapshot.json',
    html: root + 'stale-lead-tracker/index.html',
    score: root + 'tools/score.mjs',
    copy: root + 'tools/copy.mjs',
    history: root + 'stale-lead-history.json',
    diff: root + 'stale-lead-diff.json'
  });
  console.log(`refresh OK: ${res.count} contacts`);
}
