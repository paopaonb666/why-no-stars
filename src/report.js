// JSON report builder — extracted from cli.js so the shape is unit-testable.
import { T } from './render/terminal.js';

export function buildJsonReport({ facts, scorecard, benchmark, checks, version, delta = null, stale = false, locale = 'en' }) {
  return {
    schema: 1, // bump when the shape below changes meaningfully
    repo: {
      fullName: facts.fullName, stars: facts.stars, language: facts.language,
      description: facts.description, topics: facts.topics, pushedAt: facts.pushedAt,
      isArchived: Boolean(facts.isArchived), isFork: Boolean(facts.isFork),
    },
    overall: scorecard.overall,
    grade: scorecard.grade,
    // The headline fixes, pre-ranked (recoverable = points a fix restores).
    quickWins: scorecard.quickWins.map((c) => ({
      id: c.id, title: T(c.title, locale), recoverable: c.recoverable ?? null, impact: c.impact,
    })),
    stats: scorecard.stats,
    benchmark: benchmark && {
      lowerPct: Number(benchmark.lowerPct.toFixed(2)),
      upperPct: Number(benchmark.upperPct.toFixed(2)),
      buckets: benchmark.counts,
      peerLanguage: facts.language,
      totalPeers: benchmark.total,
      share0Pct: Number(benchmark.share0.toFixed(1)),
      medianBucket: T(benchmark.medianLabel, locale),
    },
    pillars: scorecard.pillars.map((p) => ({ id: p.id, name: T(p.name, locale), score: p.score, weight: p.weight })),
    checks: checks.map((c) => ({
      id: c.id, pillar: c.pillar, title: T(c.title, locale), status: c.status,
      impact: c.impact, detail: T(c.detail, locale), fix: T(c.fix, locale),
    })),
    delta: delta && {
      previousOverall: delta.previousOverall,
      diff: scorecard.overall - delta.previousOverall,
      previousAt: new Date(delta.previousAt).toISOString(),
    },
    stale: Boolean(stale), // rendered from expired cache after a rate limit
    generatedAt: new Date().toISOString(),
    tool: `why-no-stars v${version}`,
  };
}
