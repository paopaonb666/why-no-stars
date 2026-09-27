// Scoring: pillar scores, overall grade, and prioritized quick wins.
import { PILLARS } from './pillars.js';

export function grade(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

// Checks that share one root cause — showing both in "Top fixes" would spend
// two of three slots on a single edit.
const REMEDY_GROUP = {
  'install-oneliner': 'install',
  'install-above-fold': 'install',
};

// Fixes that are physically impossible on an archived repo (you can't push,
// add templates, or enable discussions there).
const UNFIXABLE_WHEN_ARCHIVED = (c) =>
  c.id === 'recent-activity' || c.pillar === 'community';

export function scoreChecks(checks, { isArchived = false } = {}) {
  const pillars = PILLARS.map((p) => {
    const mine = checks.filter((c) => c.pillar === p.id && c.status !== 'skip');
    const wsum = mine.reduce((a, c) => a + 1, 0);
    const score = wsum === 0
      ? null
      : Math.round((mine.reduce((a, c) => a + (c.score ?? 0), 0) / wsum) * 100);
    return { ...p, score, checks: mine };
  });

  const active = pillars.filter((p) => p.score !== null);
  const totalW = active.reduce((a, p) => a + p.weight, 0);
  const overall = totalW === 0
    ? 0
    : Math.round(active.reduce((a, p) => a + (p.score * p.weight), 0) / totalW);

  // Rank by the actual points a fix recovers (pillar weight / checks in pillar),
  // with a small bonus for outright fails. Ties then reflect real score impact
  // instead of definition order.
  const nByPillar = {};
  for (const p of pillars) nByPillar[p.id] = p.checks.length || 1;
  const weightById = Object.fromEntries(pillars.map((p) => [p.id, p.weight]));

  const candidates = checks
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.fix)
    .filter((c) => !(isArchived && UNFIXABLE_WHEN_ARCHIVED(c)))
    .map((c) => ({
      c,
      delta: (weightById[c.pillar] / nByPillar[c.pillar]) * (1 - (c.score ?? 0)),
      rank:
        (weightById[c.pillar] / nByPillar[c.pillar]) * (1 - (c.score ?? 0)) * 100 +
        (c.status === 'fail' ? 15 : 0),
    }))
    .sort((a, b) => b.rank - a.rank);

  const quickWins = [];
  const seenGroups = new Set();
  for (const { c } of candidates) {
    const group = REMEDY_GROUP[c.id] ?? c.id;
    if (seenGroups.has(group)) continue;
    seenGroups.add(group);
    quickWins.push(c);
    if (quickWins.length === 3) break;
  }

  const evaluated = checks.filter((c) => c.status !== 'skip');
  const passed = evaluated.filter((c) => c.status === 'pass').length;
  const failed = evaluated.filter((c) => c.status === 'fail').length;

  return {
    pillars,
    allChecks: checks,
    overall,
    grade: grade(overall),
    quickWins,
    stats: { total: evaluated.length, passed, failed, skipped: checks.length - evaluated.length },
  };
}

export function computePercentile(counts, stars) {
  // counts: star-count totals per BUCKETS entry (ascending buckets). A short
  // array (e.g. cache drift from an older version) would make `through` NaN.
  if (!Array.isArray(counts) || counts.length < BUCKET_INDEX.length || counts.some((c) => typeof c !== 'number' || c < 0)) return null;
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  let idx = BUCKET_INDEX.findIndex((test) => test(stars));
  if (idx === -1) idx = BUCKET_INDEX.length - 1;

  let before = 0;
  for (let i = 0; i < idx; i++) before += counts[i];
  const through = before + counts[idx];

  return {
    index: idx,
    total,
    before,
    through,
    lowerPct: (before / total) * 100,
    upperPct: (through / total) * 100,
  };
}

const BUCKET_INDEX = [
  (s) => s <= 0,
  (s) => s <= 2,
  (s) => s <= 9,
  (s) => s <= 99,
  (s) => s <= 999,
  (s) => s <= 9999,
  () => true,
];
