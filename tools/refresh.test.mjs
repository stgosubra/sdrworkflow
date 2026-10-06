import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRefresh } from './refresh.mjs';

function setup(){
  const dir = mkdtempSync(join(tmpdir(), 'slt-'));
  const raw = { snapshotDate: '2026-07-06', contacts: [
    { id: 1, name: 'A', qualCallDate: '2026-06-01', hasModjoNote: true, seatBand: '3-10', staleDays: 3, mqlDate: '2026-06-25', source: 'DIRECT_TRAFFIC', email: 'a@acme.com' },
    { id: 2, name: 'B', qualCallDate: null, hasModjoNote: false, seatBand: '1-2', staleDays: 20, mqlDate: '2026-04-01', source: '', email: 'b@gmail.com' }
  ]};
  writeFileSync(join(dir, 'raw.json'), JSON.stringify(raw));
  writeFileSync(join(dir, 'index.html'), 'x\nconst SNAPSHOT = /*__DATA__*/ {};\ny');
  return { dir };
}

test('refresh writes snapshot, backup, history, diff and embeds', () => {
  const { dir } = setup();
  const paths = {
    raw: join(dir, 'raw.json'),
    snapshot: join(dir, 'snapshot.json'),
    html: join(dir, 'index.html'),
    history: join(dir, 'history.json'),
    diff: join(dir, 'diff.json')
  };
  const res = runRefresh(paths);
  const snap = JSON.parse(readFileSync(paths.snapshot));
  assert.equal(snap.contacts[0].score > 0, true);
  assert.equal(typeof snap.contacts[0].segment, 'string');
  assert.match(readFileSync(paths.html, 'utf8'), /const SNAPSHOT = \/\*__DATA__\*\/ \{"snapshotDate"/);
  assert.equal(existsSync(paths.history), true);
  assert.equal(existsSync(paths.diff), true);
  assert.equal(res.count, 2);
});

test('refresh aborts (no overwrite) when a post-qual lead lacks a modjo note', () => {
  const { dir } = setup();
  // qualCallDate present but hasModjoNote missing AND seatBand missing -> validation fails
  const raw = JSON.parse(readFileSync(join(dir, 'raw.json')));
  raw.contacts.push({ id: 3, name: 'C', qualCallDate: '2026-06-01', hasModjoNote: undefined, seatBand: undefined, staleDays: 1 });
  writeFileSync(join(dir, 'raw.json'), JSON.stringify(raw));
  const paths = { raw: join(dir,'raw.json'), snapshot: join(dir,'snapshot.json'), html: join(dir,'index.html'), history: join(dir,'history.json'), diff: join(dir,'diff.json') };
  assert.throws(() => runRefresh(paths), /validation/i);
  assert.equal(existsSync(paths.snapshot), false); // nothing written on abort
});

test('refresh does NOT abort on a qual call date without a modjo note (booked-but-not-held is normal)', () => {
  const { dir } = setup();
  // valid seatBand, qualCallDate present with no hasModjoNote key -> normal "booked but not held/logged" state
  const raw = JSON.parse(readFileSync(join(dir, 'raw.json')));
  raw.contacts.push({ id: 4, name: 'D', qualCallDate: '2026-06-01', seatBand: '3-10', staleDays: 1, mqlDate: '2026-06-25', source: '', email: 'd@acme.com' });
  writeFileSync(join(dir, 'raw.json'), JSON.stringify(raw));
  const paths = { raw: join(dir,'raw.json'), snapshot: join(dir,'snapshot.json'), html: join(dir,'index.html'), history: join(dir,'history.json'), diff: join(dir,'diff.json') };
  const res = runRefresh(paths);
  assert.equal(res.count, 3);
  const snap = JSON.parse(readFileSync(paths.snapshot));
  const d = snap.contacts.find(c => c.id === 4);
  assert.equal(d.hasQual, false); // no modjo note -> not counted as a real qual
});
