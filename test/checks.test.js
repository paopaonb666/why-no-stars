import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildFacts, parseReadme, findInstallLine } from '../src/collect.js';
import { runChecks } from '../src/checks/index.js';
import { scoreChecks } from '../src/score.js';

const FIXTURE = new URL('./fixtures/got.json', import.meta.url);

function baseRepo(overrides = {}) {
  return {
    full_name: 'me/bad-repo',
    name: 'bad-repo',
    owner: { login: 'me' },
    description: null,
    topics: [],
    homepage: null,
    stargazers_count: 0,
    forks_count: 0,
    subscribers_count: 0,
    open_issues_count: 0,
    fork: false,
    archived: false,
    pushed_at: '2020-01-01T00:00:00Z',
    created_at: '2019-12-01T00:00:00Z',
    language: 'JavaScript',
    license: null,
    has_discussions: false,
    ...overrides,
  };
}

function badPayloads() {
  return {
    repo: baseRepo(),
    languages: { JavaScript: 1000 },
    community: null,
    contents: [],
    tags: [],
    releases: [],
    contributors: [],
    stargazers: [],
    stargazersFallback: [],
    packageJson: null,
    readme: null,
    workflows: { total_count: 0, workflows: [] },
    langOverride: null,
  };
}

test('an empty, abandoned repo scores low', () => {
  const facts = buildFacts(badPayloads(), { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const sc = scoreChecks(checks);
  assert.ok(sc.overall < 45, `expected < 45, got ${sc.overall}`);
  assert.ok(['D', 'F'].includes(sc.grade));
  assert.equal(sc.stats.passed, 2); // only "not a fork" and "clear primary language" pass for free
  assert.ok(sc.quickWins.length > 0);
});

test('fork repos fail the not-fork check', () => {
  const p = badPayloads();
  p.repo = baseRepo({ fork: true });
  const facts = buildFacts(p, { now: new Date() });
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'not-fork-not-archived');
  assert.equal(c.status, 'fail');
});

test('parseReadme finds headings, images, install command and code fences', () => {
  const md = [
    '# my-tool',
    '',
    'Some intro text.',
    '',
    '![logo](https://img.shields.io/badge/cool-green)',
    '',
    '## Install',
    '',
    '```bash',
    'npm install my-tool',
    '```',
    '',
    'Long docs live much further down.',
  ].join('\n');
  const r = parseReadme(md);
  assert.equal(r.lineCount, 13);
  assert.equal(r.headings[0].text, 'my-tool');
  assert.equal(r.headings[1].text, 'Install');
  assert.equal(r.images[0].line, 5);
  assert.equal(r.badges, 1);
  assert.equal(r.installLine, 10);
  assert.equal(r.codeBlocks.length, 1);
});

test('findInstallLine supports many ecosystems', () => {
  assert.equal(findInstallLine(['pip install requests']), 1);
  assert.equal(findInstallLine(['$ cargo add foo']), 1);
  assert.equal(findInstallLine(['docker run -it alpine']), 1);
  assert.equal(findInstallLine(['npx why-no-stars owner/repo']), 1);
  assert.equal(findInstallLine(['nothing here']), null);
});

test('real-world fixture (sindresorhus/got): healthy repo passes key checks', { skip: !existsSync(FIXTURE) && 'fixture not recorded yet' }, () => {
  const payloads = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const facts = buildFacts(payloads, { now: new Date() });
  const checks = runChecks(facts);
  const sc = scoreChecks(checks);

  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));
  assert.equal(byId.license.status, 'pass');
  assert.equal(byId['install-oneliner'].status, 'pass');
  assert.equal(byId.description.status, 'pass');
  assert.equal(byId.topics.status, 'pass');
  assert.equal(byId.tests.status, 'pass');
  assert.equal(sc.overall >= 70, true, `got scored ${sc.overall}`);
});

test('momentum check: no stars at all -> fail with guidance', () => {
  const facts = buildFacts(badPayloads(), { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'recent-stars');
  assert.equal(c.status, 'fail');
});

test('momentum check: huge repo with capped pagination falls back to events feed', () => {
  const p = badPayloads();
  p.repo = baseRepo({ stargazers_count: 69000 });
  p.stargazers = []; // deep pagination 404s for huge repos
  p.events = [
    { type: 'WatchEvent', created_at: '2026-09-20T00:00:00Z' },
    { type: 'PushEvent', created_at: '2026-09-21T00:00:00Z' },
  ];
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'recent-stars');
  assert.equal(c.status, 'pass'); // events feed proves recent stars (lower bound)
  assert.equal(facts.starSample, 'none');
});

test('momentum check: no data at all -> skip, never invent', () => {
  const p = badPayloads();
  p.repo = baseRepo({ stargazers_count: 69000 });
  p.stargazers = [];
  p.events = null; // events fetch also failed
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'recent-stars');
  assert.equal(c.status, 'skip');
});
