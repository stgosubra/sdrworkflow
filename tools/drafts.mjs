import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { POST_QUAL } from './copy.mjs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const firstName = c => c.firstname || (c.name ? c.name.split(' ')[0] : '') || 'there';

function readDrafted(path) {
  if (!existsSync(path)) return [];
  try { return JSON.parse(readFileSync(path)); }
  catch { console.warn(`drafts: ${path} unreadable, treating as empty (drafted state lost)`); return []; }
}

// Select Post-Qual leads that still need a draft. Auto-draft copy = POST_QUAL only.
export function planDrafts(snapshot, drafted) {
  const done = new Set((drafted || []).map(String));
  return (snapshot.contacts || [])
    .filter(c => c.hasQual && c.email && !done.has(String(c.id)))
    .map(c => {
      const t = POST_QUAL[c.outreachLang] || POST_QUAL.en;
      return { id: c.id, to: c.email, subject: t.subject, body: t.body(firstName(c)) };
    });
}

export function recordDrafted(path, ids) {
  const existing = readDrafted(path);
  const merged = Array.from(new Set([...existing.map(String), ...ids.map(String)]));
  writeFileSync(path, JSON.stringify(merged, null, 2));
  return merged;
}

// CLI: node tools/drafts.mjs plan   -> prints JSON array of {id,to,subject,body} to stdout
//      node tools/drafts.mjs record <id> [<id> ...] -> appends ids to drafted.json
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const snapshotPath = root + 'stale-lead-tracker-snapshot.json';
  const draftedPath = root + 'stale-lead-drafted.json';
  const verb = process.argv[2];
  if (verb === 'plan') {
    const snapshot = JSON.parse(readFileSync(snapshotPath));
    const drafted = readDrafted(draftedPath);
    process.stdout.write(JSON.stringify(planDrafts(snapshot, drafted), null, 2) + '\n');
  } else if (verb === 'record') {
    const ids = process.argv.slice(3);
    if (!ids.length) { console.error('record: no ids given'); process.exit(1); }
    const merged = recordDrafted(draftedPath, ids);
    console.log(`recorded ${ids.length}; ${merged.length} total drafted`);
  } else {
    console.error('usage: drafts.mjs plan | record <id> [<id> ...]');
    process.exit(1);
  }
}
