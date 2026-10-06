import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planDrafts, recordDrafted } from './drafts.mjs';
import { POST_QUAL } from './copy.mjs';

function snap() {
  return { snapshotDate: '2026-07-06', contacts: [
    { id: 10, firstname: 'Marie', email: 'marie@acme.fr', hasQual: true,  outreachLang: 'fr' },
    { id: 11, name: 'Juan Perez', email: 'juan@acme.es', hasQual: true,  outreachLang: 'es' },
    { id: 12, firstname: 'Sam',   email: 'sam@acme.com', hasQual: true,  outreachLang: 'en' },
    { id: 13, firstname: 'Nell',  email: 'nell@acme.com', hasQual: false, outreachLang: 'en' },
    { id: 14, firstname: 'NoMail', email: '',            hasQual: true,  outreachLang: 'en' }
  ]};
}

test('planDrafts includes only hasQual leads with an email, correct copy per lang', () => {
  const drafts = planDrafts(snap(), []);
  assert.deepEqual(drafts.map(d => d.id), [10, 11, 12]); // 13 not-qual, 14 no email
  const fr = drafts.find(d => d.id === 10);
  assert.equal(fr.to, 'marie@acme.fr');
  assert.equal(fr.subject, POST_QUAL.fr.subject);
  assert.equal(fr.body, POST_QUAL.fr.body('Marie'));
  const es = drafts.find(d => d.id === 11);
  assert.equal(es.body, POST_QUAL.es.body('Juan')); // first token of name
});

test('planDrafts dedups against already-drafted ids (string/number safe)', () => {
  const drafts = planDrafts(snap(), ['10', 12]);
  assert.deepEqual(drafts.map(d => d.id), [11]);
});

test('recordDrafted appends and dedups, storing string ids', () => {
  const dir = mkdtempSync(join(tmpdir(), 'slt-drafts-'));
  const p = join(dir, 'drafted.json');
  recordDrafted(p, [10, 11]);
  const merged = recordDrafted(p, ['11', 12]);
  assert.deepEqual(merged.sort(), ['10', '11', '12']);
  assert.equal(existsSync(p), true);
  assert.deepEqual(JSON.parse(readFileSync(p)).sort(), ['10', '11', '12']);
});
