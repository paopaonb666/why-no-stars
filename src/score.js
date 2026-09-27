// Scoring: pillar scores, overall grade, and prioritized quick wins.
import { PILLARS } from './pillars.js';
import { IMPACT_RANK } from './checks/helpers.js';

export function grade(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

export function scoreChecks(checks) {
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

  const quickWins = checks
    .filter((c) => (c.status === 'fail' || c.status === 'warn') && c.fix)
    .sort((a, b) => {
      const rank = (c) =>
        IMPACT_RANK[c.impact] * 100 + (c.status === 'fail' ? 50 : 0);
      return rank(b) - rank(a);
    })
    .slice(0, 3);

  const evaluated = checks.filter((c) => c.status !== 'skip');
  const passed = evaluated.filter((c) => c.status === 'pass').length;
  const failed = evaluated.filter((c) => c.status === 'fail').length;

  return {
    pillars,
    overall,
    grade: grade(overall),
    quickWins,
    stats: { total: evaluated.length, passed, failed, skipped: checks.length - evaluated.length },
  };
}

export function computePercentile(counts, stars) {
  // counts: star-count totals per BUCKETS entry (ascending buckets).
  if (!Array.isArray(counts) || counts.some((c) => typeof c !== 'number' || c < 0)) return null;
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
  (s) => s <= 9,
  (s) => s <= 99,
  (s) => s <= 999,
  (s) => s <= 9999,
  () => true,
];
