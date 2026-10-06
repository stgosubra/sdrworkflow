import { test } from 'node:test';
import assert from 'node:assert/strict';
import { embedSnapshot } from './embed.mjs';

const html = [
  'line before',
  'const SNAPSHOT = /*__DATA__*/ {"snapshotDate":"2000-01-01","contacts":[]};',
  'line after'
].join('\n');

test('replaces the SNAPSHOT line with new JSON', () => {
  const out = embedSnapshot(html, { snapshotDate: '2026-07-06', contacts: [{ id: 1 }] });
  assert.match(out, /const SNAPSHOT = \/\*__DATA__\*\/ \{"snapshotDate":"2026-07-06"/);
  assert.match(out, /line before/);
  assert.match(out, /line after/);
});

test('throws when the marker is missing', () => {
  assert.throws(() => embedSnapshot('no marker here', {}), /SNAPSHOT marker not found/);
});
