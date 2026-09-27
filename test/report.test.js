import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacts } from '../src/collect.js';
import { runChecks } from '../src/checks/index.js';
import { scoreChecks } from '../src/score.js';
import { percentileFromCounts } from '../src/benchmark.js';
import { buildJsonReport } from '../src/report.js';

// Minimal healthy-ish repo to drive the report builder.
function payloads() {
  return {
    repo: {
      full_name: 'me/demo', name: 'demo', owner: { login: 'me' },
      description: 'A demo repo', topics: ['cli'], homepage: null,
      stargazers_count: 47, forks_count: 1, subscribers_count: 2, open_issues_count: 0,
      fork: false, archived: false, pushed_at: '2026-09-20T00:00:00Z',
      created_at: '2026-06-01T00:00:00Z', language: 'Rust', license: { spdx_id: 'MIT' },
      has_discussions: false,
    },
    languages: { Rust: 1000 },
    community: { files: { license: { name: 'MIT' } } },
    contents: [{ name: 'Cargo.toml', type: 'file' }],
    tags: [{ name: 'v1.2.3' }],
    releases: [{ name: 'v1.2.3', tag_name: 'v1.2.3', published_at: '2026-09-01T00:00:00Z' }],
    contributors: [{ login: 'a' }, { login: 'b' }],
    stargazers: Array.from({ length: 5 }, (_, i) => ({ starred_at: `2026-09-1${i + 5}T00:00:00Z` })),
    events: [],
    packageJson: null,
    readme: {
      encoding: 'base64',
      content: Buffer.from('# demo\n\n## Install\n\n```bash\ncargo add demo\n```\n' + 'text\n'.repeat(55)).toString('base64'),
    },
    workflows: { total_count: 1, workflows: [{ name: 'CI' }] },
    issueTemplateProbe: 'unknown',
    securityProbe: 'known-absent',
    langOverride: null,
  };
}

function setup(locale = 'en') {
  const facts = buildFacts(payloads(), { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const scorecard = scoreChecks(checks);
  const benchmark = percentileFromCounts([1000, 3000, 3000, 800, 100, 20, 10], { stars: 47, language: 'Rust' });
  const delta = { previousOverall: 55, previousGrade: 'C', previousAt: Date.now() - 3600_000 };
  return { facts, checks, scorecard, benchmark, delta, locale };
}

test('JSON report: stable schema, localized, honest benchmark range, delta', () => {
  const s = setup();
  const r = buildJsonReport({ ...s, version: '9.9.9' });
  assert.equal(r.schema, 1);
  assert.equal(r.repo.fullName, 'me/demo');
  assert.equal(r.overall, s.scorecard.overall);
  assert.match(r.tool, /why-no-stars v9\.9\.9$/);
  assert.equal(r.benchmark.peerLanguage, 'Rust');
  assert.ok(r.benchmark.lowerPct <= r.benchmark.upperPct);
  assert.equal(typeof r.benchmark.totalPeers, 'number');
  assert.equal(r.delta.previousOverall, 55);
  assert.equal(r.delta.diff, s.scorecard.overall - 55);
  assert.ok(r.delta.previousAt.endsWith('Z'));
  assert.equal(r.stale, false);
  // all checks serialized with localized titles
  assert.equal(r.checks.length, s.checks.length);
  assert.ok(r.checks.every((c) => typeof c.title === 'string' && c.title.length > 0));
});

test('JSON report: zh locale localizes pillar and check titles; stale flag survives', () => {
  const s = setup('zh');
  const r = buildJsonReport({ ...s, version: '1.0.0', stale: true });
  assert.equal(r.stale, true);
  assert.ok(r.pillars.some((p) => p.name === '第一印象'));
  assert.ok(r.checks.some((c) => /描|说/.test(c.title)));
});

test('JSON report: benchmark omitted when null; delta omitted when no history', () => {
  const s = setup();
  const r = buildJsonReport({ ...s, benchmark: null, delta: null });
  assert.equal(r.benchmark, null);
  assert.equal(r.delta, null);
});
