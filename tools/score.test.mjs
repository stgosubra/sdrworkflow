import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enrich, scoreColor, stalenessTier, scoreBreakdown } from './score.mjs';

const snap = JSON.parse(readFileSync(new URL('../stale-lead-tracker-snapshot.json', import.meta.url)));
const now = new Date(snap.snapshotDate).getTime();
const freeDomains = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','msn.com','aol.com','icloud.com','me.com','mac.com','proton.me','protonmail.com','mail.com','mail.ru','yandex.ru','gmx.com','zoho.com','qq.com','163.com','126.com','web.de','laposte.net','orange.fr','free.fr','sfr.fr','wanadoo.fr','personal.com']);
const enriched = enrich(snap.contacts, { now, freeDomains });
const byId = id => enriched.find(c => String(c.id) === id);

test('Matej scores 7.8 (qual held + band 3-10)', () => {
  assert.equal(byId('229294807887').score, 7.8);
});

test('Fabian scores 4.5 (no modjo note, no qual bonus)', () => {
  assert.equal(byId('230890715805').score, 4.5);
});

test('exactly 12 contacts have a real qual call', () => {
  assert.equal(enriched.filter(c => c.hasQual).length, 12);
});

test('scoreColor thresholds', () => {
  assert.equal(scoreColor(7.0), 'score-hot');
  assert.equal(scoreColor(5.0), 'score-warm');
  assert.equal(scoreColor(3.0), 'score-cool');
  assert.equal(scoreColor(1.0), 'score-cold');
});

test('segment mirrors scoreColor without the prefix', () => {
  assert.equal(byId('229294807887').segment, 'hot');
});

test('scoreColor boundaries', () => {
  assert.equal(scoreColor(6.5), 'score-hot');
  assert.equal(scoreColor(6.49), 'score-warm');
  assert.equal(scoreColor(4.5), 'score-warm');
  assert.equal(scoreColor(4.49), 'score-cool');
  assert.equal(scoreColor(2.5), 'score-cool');
  assert.equal(scoreColor(2.49), 'score-cold');
});

test('stalenessTier penalties by day bucket', () => {
  assert.equal(stalenessTier(null).penalty, -2.0);
  assert.equal(stalenessTier(3).penalty, 0);
  assert.equal(stalenessTier(10).penalty, -0.8);
  assert.equal(stalenessTier(18).penalty, -1.5);
  assert.equal(stalenessTier(25).penalty, -2.0);
  assert.equal(stalenessTier(40).penalty, -2.5);
  assert.equal(stalenessTier(60).penalty, -3.5);
});

test('null staleDays renders "never" not "neverd"', () => {
  const b = scoreBreakdown({ staleDays: null }, Date.now(), new Set());
  const line = b.lines.find(l => l.l.startsWith('Staleness'));
  assert.ok(line, 'expected a staleness line');
  assert.ok(!line.l.includes('neverd'), `label should not contain "neverd": ${line.l}`);
});

test('language routing: France->fr, Spain->es, other->en', () => {
  const raw = {
    snapshotDate: '2026-07-06',
    contacts: [
      { id: 1, finalCountry: 'France', qualCallDate: null, hasModjoNote: false, seatBand: '3-10', staleDays: 3, mqlDate: '2026-06-25', source: '', email: 'a@test.com' },
      { id: 2, finalCountry: 'Spain', qualCallDate: null, hasModjoNote: false, seatBand: '1-2', staleDays: 5, mqlDate: '2026-06-20', source: '', email: 'b@test.com' },
      { id: 3, finalCountry: 'Germany', qualCallDate: null, hasModjoNote: false, seatBand: '3-10', staleDays: 10, mqlDate: '2026-06-10', source: '', email: 'c@test.com' },
      { id: 4, finalCountry: null, qualCallDate: null, hasModjoNote: false, seatBand: '3-10', staleDays: 2, mqlDate: '2026-07-01', source: '', email: 'd@test.com' }
    ]
  };
  const now = new Date(raw.snapshotDate).getTime();
  const enriched = enrich(raw.contacts, { now, freeDomains: new Set() });
  assert.equal(enriched.find(c=>c.id===1).outreachLang, 'fr');
  assert.equal(enriched.find(c=>c.id===2).outreachLang, 'es');
  assert.equal(enriched.find(c=>c.id===3).outreachLang, 'en');
  assert.equal(enriched.find(c=>c.id===4).outreachLang, 'en');
});

test('language routing falls back to country when finalCountry is absent', () => {
  const raw = {
    snapshotDate: '2026-07-06',
    contacts: [
      // no finalCountry field at all -> use country
      { id: 5, country: 'France', qualCallDate: null, hasModjoNote: false, seatBand: '3-10', staleDays: 3, mqlDate: '2026-06-25', source: '', email: 'e@test.com' },
      { id: 6, country: 'Spain', qualCallDate: null, hasModjoNote: false, seatBand: '1-2', staleDays: 5, mqlDate: '2026-06-20', source: '', email: 'f@test.com' },
      // finalCountry takes precedence over country when present
      { id: 7, finalCountry: 'Spain', country: 'France', qualCallDate: null, hasModjoNote: false, seatBand: '3-10', staleDays: 2, mqlDate: '2026-07-01', source: '', email: 'g@test.com' }
    ]
  };
  const now = new Date(raw.snapshotDate).getTime();
  const enriched = enrich(raw.contacts, { now, freeDomains: new Set() });
  assert.equal(enriched.find(c=>c.id===5).outreachLang, 'fr');
  assert.equal(enriched.find(c=>c.id===6).outreachLang, 'es');
  assert.equal(enriched.find(c=>c.id===7).outreachLang, 'es');
});

test('outreachLang routing is case-insensitive for final_country', () => {
  const now = new Date('2026-07-06').getTime();
  const contacts = [
    { id: 1, finalCountry: 'france', seatBand: '3-10', staleDays: 3 },
    { id: 2, finalCountry: 'SPAIN', seatBand: '3-10', staleDays: 3 },
    { id: 3, finalCountry: 'Germany', seatBand: '3-10', staleDays: 3 },
    { id: 4, country: 'España', seatBand: '3-10', staleDays: 3 }
  ];
  const out = enrich(contacts, { now, freeDomains: new Set() });
  assert.equal(out[0].outreachLang, 'fr');
  assert.equal(out[1].outreachLang, 'es');
  assert.equal(out[2].outreachLang, 'en');
  assert.equal(out[3].outreachLang, 'en'); // 'España' is not 'spain' -> stays en (strict routing)
});
