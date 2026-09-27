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

function mkId(id, pillar, status) {
  return {
    id, pillar, title: { en: 't', zh: '测' }, status,
    score: status === 'pass' ? 1 : status === 'warn' ? 0.5 : status === 'skip' ? null : 0,
    detail: null, fix: { en: 'f', zh: '修' }, impact: 'high',
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

test('quickWins: biggest recoverable score first (pillar weight / checks in pillar)', () => {
  // Equal-size pillars: trust fail recovers 20/2 = 10 pts; momentum 10/2 = 5 pts.
  const checks = [
    mkId('license', 'trust', 'fail'),
    mkId('trust-filler', 'trust', 'pass'),
    mkId('recent-stars', 'momentum', 'fail'),
    mkId('momentum-filler', 'momentum', 'pass'),
  ];
  const sc = scoreChecks(checks);
  assert.equal(sc.quickWins[0].id, 'license');
  assert.equal(sc.quickWins[1].id, 'recent-stars');
});

test('quickWins: an outright fail outranks an equal-size warn', () => {
  const checks = [
    mkId('a', 'quickstart', 'warn'),
    mkId('b', 'quickstart', 'fail'),
  ];
  const sc = scoreChecks(checks);
  assert.equal(sc.quickWins[0].id, 'b');
});

test('quickWins: one slot per root cause (install dedupe)', () => {
  const checks = [
    mkId('install-oneliner', 'quickstart', 'fail'),
    mkId('install-above-fold', 'quickstart', 'fail'),
    mkId('description', 'first-impression', 'fail'),
  ];
  const sc = scoreChecks(checks);
  assert.equal(sc.quickWins.length, 2); // dedupe collapses the two install checks
  const ids = sc.quickWins.map((c) => c.id);
  assert.ok(!(ids.includes('install-oneliner') && ids.includes('install-above-fold')));
  assert.ok(ids.includes('description'));
});

test('quickWins: archived repos never get impossible fixes', () => {
  const checks = [mkId('recent-activity', 'trust', 'fail'), mkId('coc', 'community', 'warn'), mkId('topics', 'first-impression', 'fail')];
  const sc = scoreChecks(checks, { isArchived: true });
  const ids = sc.quickWins.map((c) => c.id);
  assert.ok(!ids.includes('recent-activity'));
  assert.ok(!ids.includes('coc'));
  assert.equal(ids[0], 'topics');
});

test('overall weighting across pillars', () => {
  const checks = [
    mkId('a', 'first-impression', 'pass'),
    mkId('b', 'first-impression', 'pass'),
    mkId('c', 'quickstart', 'fail'),
  ];
  const sc = scoreChecks(checks);
  // FI pillar 100 (w 25), QS pillar 0 (w 20) → (2500)/45 = 55.6 → 56
  assert.equal(sc.overall, 56);
});

test('pillars with only skipped checks are excluded, not zeroed', () => {
  const checks = [mkId('a', 'first-impression', 'pass'), mkId('s', 'trust', 'skip')];
  const sc = scoreChecks(checks);
  assert.equal(sc.overall, 100);
});

test('computePercentile: honest range within the bucket (7 buckets)', () => {
  // buckets: 0, 1–2, 3–9, 10–99, 100–999, 1k–10k, 10k+
  const counts = [1000, 2000, 3000, 800, 100, 20, 10];
  const total = counts.reduce((a, b) => a + b, 0); // 6930
  const r = computePercentile(counts, 47); // in 10-99 bucket (index 3)
  assert.equal(r.index, 3);
  assert.equal(r.total, total);
  // before = 1000+2000+3000 = 6000
  assert.ok(Math.abs(r.lowerPct - (6000 / total) * 100) < 0.001);
  // through = 6000+800 = 6800
  assert.ok(Math.abs(r.upperPct - (6800 / total) * 100) < 0.001);
});

test('computePercentile: 0 stars sits in the first bucket', () => {
  const r = computePercentile([1000, 2000, 3000, 800, 100, 20, 10], 0);
  assert.equal(r.index, 0);
  assert.equal(r.lowerPct, 0);
});

test('computePercentile: rejects garbage', () => {
  assert.equal(computePercentile(null, 5), null);
  assert.equal(computePercentile([0, 0, 0], 5), null);
  assert.equal(computePercentile([1, 'x', 2], 5), null);
});
