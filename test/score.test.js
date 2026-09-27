import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, scoreChecks, computePercentile } from '../src/score.js';
import { PILLARS } from '../src/pillars.js';

test('grade boundaries', () => {
  assert.equal(grade(95), 'S');
  assert.equal(grade(90), 'S');
  assert.equal(grade(89.9), 'A');
  assert.equal(grade(80), 'A');
  assert.equal(grade(70), 'B');
  assert.equal(grade(60), 'C');
  assert.equal(grade(45), 'D');
  assert.equal(grade(0), 'F');
});

function mk(pillar, status, impact = 'low') {
  return {
    id: `${pillar}-${Math.random().toString(36).slice(2, 7)}`,
    pillar,
    title: { en: 't', zh: '测' },
    status,
    score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : status === 'skip' ? null : 0,
    detail: null,
    fix: { en: 'fix me', zh: '修' },
    impact,
  };
}

test('pillar scoring: warn counts as half, skip excluded', () => {
  const checks = [
    mk('trust', 'pass'),
    mk('trust', 'warn'),
    mk('trust', 'skip'),
  ];
  const sc = scoreChecks(checks);
  const trust = sc.pillars.find((p) => p.id === 'trust');
  assert.equal(trust.score, 75); // (1 + 0.5) / 2
  assert.equal(trust.checks.length, 2);
});

test('overall is a weighted mean across pillars', () => {
  // single pillar with weight 25 -> overall equals that pillar's score
  const checks = PILLARS.flatMap((p) =>
    p.id === 'quickstart' ? [mk('quickstart', 'fail')] : []
  );
  const sc = scoreChecks(checks);
  // only quickstart has evaluated checks; others null => overall == pillar score
  assert.equal(sc.overall, 0);
});

test('quickWins: high-impact failures first', () => {
  const checks = [
    mk('trust', 'fail', 'low'),
    mk('trust', 'fail', 'high'),
    mk('trust', 'warn', 'medium'),
    mk('trust', 'pass', 'high'),
  ];
  const sc = scoreChecks(checks);
  assert.equal(sc.quickWins[0].impact, 'high');
  assert.equal(sc.quickWins[0].status, 'fail');
  assert.equal(sc.quickWins.length, 3);
});

test('computePercentile: honest range within the bucket', () => {
  // buckets: 0, 1-9, 10-99, 100-999, 1k-10k, 10k+
  const counts = [1000, 5000, 3000, 800, 100, 20];
  const total = counts.reduce((a, b) => a + b, 0); // 9920
  const r = computePercentile(counts, 47); // in 10-99 bucket (index 2)
  assert.equal(r.index, 2);
  assert.equal(r.total, total);
  // before = 1000+5000 = 6000 -> 60.48%
  assert.ok(Math.abs(r.lowerPct - (6000 / total) * 100) < 0.001);
  // through = 6000+3000 = 9000 -> 90.72%
  assert.ok(Math.abs(r.upperPct - (9000 / total) * 100) < 0.001);
});

test('computePercentile: 0 stars sits in the first bucket', () => {
  const r = computePercentile([1000, 5000, 3000, 800, 100, 20], 0);
  assert.equal(r.index, 0);
  assert.equal(r.lowerPct, 0);
});

test('computePercentile: rejects garbage', () => {
  assert.equal(computePercentile(null, 5), null);
  assert.equal(computePercentile([0, 0, 0], 5), null);
  assert.equal(computePercentile([1, 'x', 2], 5), null);
});
