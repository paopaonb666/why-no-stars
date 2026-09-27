import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starPercentile, BUCKETS } from '../src/benchmark.js';

function fakeClient(counts, { paths = [], failAt = -1 } = {}) {
  return {
    getSearch: async (path) => {
      paths.push(path);
      if (failAt === paths.length) throw new Error('secondary rate limit');
      return { total_count: counts[paths.length - 1] ?? 0 };
    },
  };
}

test('starPercentile: honest range, median bucket, and one search per bucket', async () => {
  const counts = [500, 300, 100, 60, 30, 10, 5]; // total 1005; cum 50% crosses in bucket 1
  const paths = [];
  const b = await starPercentile(fakeClient(counts, { paths }), { stars: 47, staggerMs: 0 });
  assert.equal(paths.length, BUCKETS.length); // exactly one call per bucket
  assert.deepEqual(b.counts, counts);
  assert.equal(b.index, 3); // 47 stars -> 10..99 bucket
  assert.ok(Math.abs(b.lowerPct - (900 / 1005) * 100) < 0.01);
  assert.ok(Math.abs(b.upperPct - (960 / 1005) * 100) < 0.01);
  assert.equal(b.medianIdx, 1); // cumulative share crosses 50% in the 1–2 bucket
  assert.equal(b.total, 1005);
  assert.ok(b.share0 > 49 && b.share0 < 51);
});

test('starPercentile: language query is encoded (C++ -> C%2B%2B)', async () => {
  const paths = [];
  await starPercentile(
    fakeClient([1, 1, 1, 1, 1, 1, 1], { paths }),
    { stars: 1, language: 'C++', staggerMs: 0 }
  );
  assert.ok(paths[0].includes('language:C%2B%2B'));
  assert.ok(paths[0].includes(encodeURIComponent('stars:0')));
});

test('starPercentile: any search failure -> null (best-effort, never throws)', async () => {
  const b = await starPercentile(fakeClient([1, 1, 1, 1, 1, 1, 1], { failAt: 3 }), { stars: 10, staggerMs: 0 });
  assert.equal(b, null);
});

test('starPercentile: zero-star ecosystem (all buckets empty) -> null, not NaN', async () => {
  const b = await starPercentile(fakeClient([0, 0, 0, 0, 0, 0, 0]), { stars: 0, staggerMs: 0 });
  assert.equal(b, null);
});
