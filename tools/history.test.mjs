import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffRuns, historyEntry } from './history.mjs';

test('historyEntry captures minimal per-contact state', () => {
  const e = historyEntry('2026-07-06', [{ id: 1, segment: 'hot', hasQual: true, score: 7.8, staleDays: 3 }]);
  assert.equal(e.date, '2026-07-06');
  assert.deepEqual(e.contacts[0], { id: 1, segment: 'hot', hasQual: true, score: 7.8, staleDays: 3 });
});

test('diff detects newly-hot, newly-stale and dropped', () => {
  const prev = [
    { id: 1, segment: 'warm', staleDays: 3 },
    { id: 2, segment: 'cool', staleDays: 3 },
    { id: 3, segment: 'cold', staleDays: 3 }
  ];
  const curr = [
    { id: 1, segment: 'hot', staleDays: 3 },
    { id: 2, segment: 'cool', staleDays: 9 }
  ];
  const d = diffRuns(prev, curr);
  assert.deepEqual(d.newlyHot, [1]);
  assert.deepEqual(d.newlyStale, [2]);
  assert.deepEqual(d.dropped, [3]);
});

test('diff tolerates missing previous run', () => {
  const d = diffRuns(null, [{ id: 1, segment: 'hot', staleDays: 1 }]);
  assert.deepEqual(d, { newlyHot: [], newlyStale: [], dropped: [] });
});
