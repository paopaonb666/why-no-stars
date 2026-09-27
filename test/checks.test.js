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
    stargazersFallback: [], // legacy key kept in fixtures; no longer read by src
    events: null,
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

test('images and badges inside code fences are not counted', () => {
  const md = [
    '# t',
    '',
    '```md',
    '![not-rendered](https://img.shields.io/badge/fenced-x)',
    '```',
    '',
    '![rendered](https://img.shields.io/badge/real-green)',
    '',
    'body text',
  ].join('\n');
  const r = parseReadme(md);
  assert.equal(r.images.length, 1); // only the unfenced one
  assert.equal(r.images[0].line, 7);
  assert.equal(r.badges, 1);
});

test('parseReadme: HTML images/headings, HTML comments, setext titles', () => {
  const md = [
    '<div align="center">',
    '<!-- hidden ![ghost](https://img.shields.io/badge/ghost-x) -->',
    '<img src="media/logo.svg" width="300">',
    '</div>',
    '',
    'The **Kernel**',
    '============',
    '',
    '<h2>Usage</h2>',
    '',
    'body',
  ].join('\n');
  const r = parseReadme(md);
  assert.equal(r.images.length, 1); // commented-out badge is invisible
  assert.equal(r.images[0].badge, false);
  assert.equal(r.badges, 0);
  const l1 = r.headings.find((h) => h.level === 1);
  assert.equal(l1.text, 'The **Kernel**'); // setext heading
  assert.ok(r.headings.some((h) => h.level === 2 && h.text === 'Usage')); // HTML heading
});

test('hero-visual: badge-only images are not a hero', () => {
  const p = badPayloads();
  p.repo = baseRepo({ description: 'x'.repeat(20), topics: ['a', 'b', 'c'] });
  p.readme = {
    encoding: 'base64',
    content: Buffer.from('# t\n\n![b](https://img.shields.io/badge/x-y)\n').toString('base64'),
  };
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'hero-visual');
  assert.equal(c.status, 'fail');
  assert.match(c.detail.en, /[Bb]adge/);
});

test('parseReadme: fence closing respects marker char, length, and bare-line rule', () => {
  // ~~~ fence is NOT closed by ``` (docs showing markdown examples)
  const tilde = parseReadme([
    '# t',
    '',
    '~~~md',
    '# not a heading inside fence',
    '```',
    'nested triple backticks are content',
    '```',
    '~~~',
    '',
    'body',
  ].join('\n'));
  assert.equal(tilde.codeBlocks.length, 1);
  assert.ok(!tilde.headings.some((h) => h.text === 'not a heading inside fence'));

  // a 4-backtick fence survives an inner 3-backtick line
  const quad = parseReadme([
    '# q',
    '',
    '````md',
    '```js',
    'code();',
    '```',
    '````',
    '',
    'body',
  ].join('\n'));
  assert.equal(quad.codeBlocks.length, 1);
  assert.equal(quad.codeBlocks[0].start, 3);
  assert.equal(quad.codeBlocks[0].end, 7);
});

test('parseReadme: setext underlines inside code blocks and after list items are ignored', () => {
  const md = [
    '# t',
    '',
    '```yaml',
    'key: value',
    '---',
    '```',
    '',
    '- list item',
    '---',
    '',
    'Real section',
    '===',
  ].join('\n');
  const r = parseReadme(md);
  const texts = r.headings.map((h) => h.text);
  assert.ok(!texts.includes('key: value'), 'fenced pair must not become a heading');
  assert.ok(!texts.includes('- list item'), 'list item + --- is a thematic break, not a heading');
  assert.ok(texts.includes('Real section'));
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

test('got fixture at a fixed date pins the score (methodology tripwire)', { skip: !existsSync(FIXTURE) && 'fixture not recorded yet' }, () => {
  const payloads = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const facts = buildFacts(payloads, { now: new Date('2026-09-27T00:00:00Z') });
  const sc = scoreChecks(runChecks(facts), { isArchived: facts.isArchived });
  // If this pins break, scoring methodology moved — update it deliberately
  // and say so in the changelog.
  assert.equal(sc.overall, 92);
  assert.equal(sc.grade, 'S');
});

const REACT_FIXTURE = new URL('./fixtures/react.json', import.meta.url);

test('real-world fixture (facebook/react): mega-repo paths hold up on live data', { skip: !existsSync(REACT_FIXTURE) && 'fixture not recorded yet' }, () => {
  const payloads = JSON.parse(readFileSync(REACT_FIXTURE, 'utf8'));
  // Fixed date: the fixture's newest WatchEvent is 2026-09-27T13:06Z, so a
  // moving clock would age the events out of the 28-day window ~Oct 25 and
  // break this test with zero code changes.
  const facts = buildFacts(payloads, { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const sc = scoreChecks(checks);
  const byId = Object.fromEntries(checks.map((c) => [c.id, c]));

  // deep stargazers pagination is capped by GitHub -> sample 'none', and the
  // events feed is the honest fallback (fixture was recorded live, so events
  // exist; the recency verdict itself is time-dependent and NOT asserted)
  assert.equal(facts.starSample, 'none');
  assert.equal(facts.eventsPresent, true);
  assert.equal(facts.recentStarEvents28 >= 1, true, 'recorded feed should show recent stars');

  // community profile + probes: react has all the files
  assert.equal(byId['issue-template'].status, 'pass');
  assert.equal(byId['security-policy'].status, 'pass');
  assert.equal(byId.license.status, 'pass'); // MIT
  assert.equal(byId['not-fork-not-archived'].status, 'pass');
  assert.equal(byId.tests.status, 'pass');
  assert.equal(byId.semver.status, 'pass');

  // honest even for famous repos: react's README ships no install one-liner
  // and no hero image — both FAILs are real, not parser bugs
  assert.equal(byId['install-oneliner'].status, 'fail');
  assert.equal(byId['hero-visual'].status, 'fail');

  assert.equal(sc.overall >= 70, true, `react scored ${sc.overall}`);
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

test('momentum check: partial last page (101–199 stars) is still a valid sample', () => {
  const p = badPayloads();
  p.repo = baseRepo({ stargazers_count: 150 });
  // page 2 of a 150-star repo returns only 50 rows — that's the newest 50 stars
  p.stargazers = Array.from({ length: 50 }, (_, i) => ({
    starred_at: `2026-09-${String(10 + i).padStart(2, '0')}T00:00:00Z`,
  }));
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  assert.equal(facts.starSample, 'lastpage');
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'recent-stars');
  assert.equal(c.status, 'pass'); // 2026-09-10..26 all within 28 days of the 27th
});

test('momentum check: failed stargazers fetch with no events -> skip, never invent', () => {
  const p = badPayloads();
  p.repo = baseRepo({ stargazers_count: 69000 });
  p.stargazers = null; // deep pagination 404s
  p.events = null; // events fetch also failed
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const c = checks.find((x) => x.id === 'recent-stars');
  assert.equal(c.status, 'skip');
});

test('community checks: profile fetch failed -> honest skip, never a fabricated absence', () => {
  const facts = buildFacts(badPayloads(), { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  for (const id of ['issue-template', 'pr-template', 'contributing', 'coc', 'security-policy']) {
    assert.equal(checks.find((c) => c.id === id).status, 'skip', id);
  }
  // discussions comes from the repo payload (always present) — still evaluated
  assert.equal(checks.find((c) => c.id === 'discussions').status, 'warn');
});

test('community checks: probe knowledge survives a null community profile', () => {
  const p = badPayloads();
  p.securityProbe = 'known-present'; // probe confirmed SECURITY.md exists
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  assert.equal(checks.find((c) => c.id === 'security-policy').status, 'pass');
  assert.equal(checks.find((c) => c.id === 'issue-template').status, 'skip'); // still unknown
});

test('install detection: deno/dlx/npm exec/uv sync and shouting case', () => {
  assert.equal(findInstallLine(['deno add jsr:@std/path']), 1);
  assert.equal(findInstallLine(['pnpm dlx shadcn@latest init']), 1);
  assert.equal(findInstallLine(['npm exec --yes tsx src/main.ts']), 1);
  assert.equal(findInstallLine(['uv sync --all-extras']), 1);
  assert.equal(findInstallLine(['NPM INSTALL']), 1);
  assert.equal(findInstallLine(['(cargo install ripgrep)']), 1);
  assert.equal(findInstallLine(['just run the tests']), null);
});

test('license check: package.json contradicting the repo license warns', () => {
  const p = badPayloads();
  p.repo = baseRepo({ license: { spdx_id: 'MIT' } });
  p.community = { files: { license: { name: 'MIT' } } };
  const pkg = (obj) => ({ encoding: 'base64', content: Buffer.from(JSON.stringify(obj)).toString('base64') });
  p.packageJson = pkg({ license: 'ISC' });
  const c = runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'license');
  assert.equal(c.status, 'warn');
  assert.match(c.detail.en, /package\.json says .ISC/);
});

test('license check: matching or dual-license package.json stays pass', () => {
  const p = badPayloads();
  p.repo = baseRepo({ license: { spdx_id: 'MIT' } });
  p.community = { files: { license: { name: 'MIT' } } };
  const pkg = (obj) => ({ encoding: 'base64', content: Buffer.from(JSON.stringify(obj)).toString('base64') });
  p.packageJson = pkg({ license: 'MIT' });
  assert.equal(runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'license').status, 'pass');
  p.packageJson = pkg({ license: '(MIT OR Apache-2.0)' });
  assert.equal(runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'license').status, 'pass');
});

test('topics check: more than 20 topics warns about the GitHub cap', () => {
  const p = badPayloads();
  p.readme = { encoding: 'base64', content: Buffer.from('# t\n').toString('base64') };
  p.repo = baseRepo({ topics: Array.from({ length: 21 }, (_, i) => `topic${i}`) });
  const c = runChecks(buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') })).find((x) => x.id === 'topics');
  assert.equal(c.status, 'warn');
  assert.match(c.detail.en, /caps repos at 20/);
});

test('releases check: recent pushes but a stale latest release warns', () => {
  const p = badPayloads();
  p.repo = baseRepo({ pushed_at: '2026-09-20T00:00:00Z' });
  p.releases = [{ name: 'v1.0.0', tag_name: 'v1.0.0', published_at: '2025-01-01T00:00:00Z' }];
  p.tags = [{ name: 'v1.0.0' }];
  const c = runChecks(buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') })).find((x) => x.id === 'releases');
  assert.equal(c.status, 'warn');
  assert.match(c.detail.en, /days old while code was pushed/);
});

test('releases check: a DRAFT release is not a published release', () => {
  const p = badPayloads();
  p.repo = baseRepo({ pushed_at: '2026-09-20T00:00:00Z' });
  // GitHub returns drafts (published_at: null) to authenticated callers;
  // visitors see nothing, so scoring them as releases fabricates trust.
  p.releases = [
    { name: 'v2.0-draft', tag_name: 'v2.0', published_at: null },
    { name: 'v1.0.0', tag_name: 'v1.0.0', published_at: '2025-01-01T00:00:00Z' },
  ];
  p.tags = [{ name: 'v1.0.0' }];
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const c = runChecks(facts).find((x) => x.id === 'releases');
  assert.equal(c.status, 'warn'); // only v1.0.0 is public, and it is stale
  assert.match(c.detail.en, /published release\(s\)/);
  assert.match(c.detail.en, /v1\.0\.0/); // latest PUBLISHED, not the draft
});

test('quickWins carry recoverable points for honest display', () => {
  const p = badPayloads();
  p.repo = baseRepo({ license: { spdx_id: 'MIT' }, description: 'x'.repeat(20), topics: ['a', 'b', 'c'], pushed_at: '2026-09-20T00:00:00Z' });
  p.community = { files: { license: { name: 'MIT' } } };
  p.readme = { encoding: 'base64', content: Buffer.from('# t\n\n## Install\n\n```bash\nnpm i t\n```\n' + 'x\n'.repeat(50)).toString('base64') };
  const sc = scoreChecks(runChecks(buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') })));
  assert.ok(sc.quickWins.length > 0);
  for (const w of sc.quickWins) {
    assert.equal(typeof w.recoverable, 'number');
    assert.ok(w.recoverable > 0);
  }
});

// --- honesty fixes from the red-team audit: refused data is never evidence ---

test('license: repo-payload spdx survives a refused community profile', () => {
  const p = badPayloads();
  p.repo = baseRepo({ license: { spdx_id: 'MIT' } });
  p.community = null; // profile fetch refused
  const facts = buildFacts(p, { now: new Date() });
  const c = runChecks(facts).find((x) => x.id === 'license');
  assert.equal(c.status, 'pass'); // spdx comes from the repo payload, not the profile
  assert.match(c.detail.en, /repo metadata/);
  // no license info anywhere -> skip, never "no license"
  const p2 = badPayloads();
  p2.repo = baseRepo({ license: null });
  const c2 = runChecks(buildFacts(p2, { now: new Date() })).find((x) => x.id === 'license');
  assert.equal(c2.status, 'skip');
});

test('community details render file names, never [object Object]', () => {
  const p = badPayloads();
  p.community = { files: { issue_template: { key: 'issue_template', name: 'bug_report.md', html_url: 'https://x' } } };
  const c = runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'issue-template');
  assert.equal(c.status, 'pass');
  assert.equal(c.detail.en, 'Found: bug_report.md');
  assert.ok(!c.detail.en.includes('[object Object]'));
});

test('an inconclusive contents probe skips instead of claiming absence', () => {
  const p = badPayloads();
  p.community = { files: {} }; // profile loads but claims nothing
  p.issueTemplateProbe = 'unknown'; // probe errored (not 404)
  p.securityProbe = 'unknown';
  const checks = runChecks(buildFacts(p, { now: new Date() }));
  assert.equal(checks.find((x) => x.id === 'issue-template').status, 'skip');
  assert.equal(checks.find((x) => x.id === 'security-policy').status, 'skip');
});

test('unknown push time skips recent-activity instead of "abandoned"', () => {
  const p = badPayloads();
  p.repo = baseRepo({ pushed_at: null });
  const c = runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'recent-activity');
  assert.equal(c.status, 'skip');
  assert.match(c.detail.en, /Unknown last-push/);
});

test('title-match skips for README-less repos (no double punishment)', () => {
  const checks = runChecks(buildFacts(badPayloads(), { now: new Date() }));
  assert.equal(checks.find((x) => x.id === 'title-match').status, 'skip');
});

test('refused /contents and /workflows fetches degrade to skips, not "empty"', () => {
  const p = badPayloads();
  p.contents = null; // /contents fetch refused
  p.workflows = null; // /workflows fetch refused
  const checks = runChecks(buildFacts(p, { now: new Date() }));
  for (const id of ['examples-dir', 'manifest']) {
    assert.equal(checks.find((x) => x.id === id).status, 'skip', id);
  }
  assert.equal(checks.find((x) => x.id === 'ci').status, 'skip');
  // tests: no signals visible AND root list unknown -> skip (not warn)
  assert.equal(checks.find((x) => x.id === 'tests').status, 'skip');
});

test('a refused /readme fetch skips readme-exists instead of "No README found"', () => {
  const p = badPayloads();
  p.readme = null;
  p.readmeState = 'unknown'; // transient API failure recorded by fetchPayloads
  const facts = buildFacts(p, { now: new Date() });
  const c = runChecks(facts).find((x) => x.id === 'readme-exists');
  assert.equal(c.status, 'skip');
  assert.match(c.detail.en, /API refused/);
  // legacy fixture shape (no readmeState key) keeps the honest fail
  const p2 = badPayloads();
  const c2 = runChecks(buildFacts(p2, { now: new Date() })).find((x) => x.id === 'readme-exists');
  assert.equal(c2.status, 'fail');
});

test('a refused package.json skips the tests check for manifest repos', () => {
  const p = badPayloads();
  p.contents = [{ name: 'package.json', type: 'file' }]; // manifest visible
  p.packageJson = null;
  p.packageJsonKnown = false; // the /contents/package.json fetch was refused
  const c = runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'tests');
  assert.equal(c.status, 'skip');
  assert.match(c.detail.en, /test script unverifiable|package\.json could not be fetched/);
});

test('star-velocity: full history uses the 90-day window, not the lifetime average', () => {
  const p = badPayloads();
  p.repo = baseRepo({ stargazers_count: 100, created_at: '2025-01-01T00:00:00Z', pushed_at: '2026-09-20T00:00:00Z' });
  // 100 stars (=> 'full' sample): star i happened (i*4 + 1) days before the fixed now.
  // Within the last 90 days: i <= 22 -> 23 stars -> ~1.8/week (pass); the lifetime
  // average over 91 weeks would be ~1.1/week — assert the WINDOW phrasing to pin it.
  p.stargazers = Array.from({ length: 100 }, (_, i) => ({
    starred_at: new Date(Date.parse('2026-09-27T00:00:00Z') - (i * 4 + 1) * 86400000).toISOString(),
  }));
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  assert.equal(facts.starSample, 'full');
  const c = runChecks(facts).find((x) => x.id === 'star-velocity');
  assert.equal(c.status, 'pass');
  assert.match(c.detail.en, /full history known/);
  assert.match(c.detail.en, /23 star\(s\) in the last 90 days/);
});

test('corrupted cache payloads surface as skips, never NaN-day FAILs', () => {
  const p = badPayloads();
  p.repo = baseRepo({ pushed_at: 'abc' }); // hand-corrupted cache shape
  const checks = runChecks(buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') }));
  assert.equal(checks.find((x) => x.id === 'recent-activity').status, 'skip');
  // garbage star count coerces to 0 (honest fail), never "NaN stars/week"
  const p2 = badPayloads();
  p2.repo = baseRepo({ stargazers_count: 'abc', created_at: '2026-08-01T00:00:00Z', pushed_at: '2026-09-20T00:00:00Z' });
  const facts2 = buildFacts(p2, { now: new Date('2026-09-27T00:00:00Z') });
  assert.equal(facts2.stars, 0);
  const v = runChecks(facts2).find((x) => x.id === 'star-velocity');
  assert.ok(!JSON.stringify(v).includes('NaN'));
});

test('community payloads of the wrong TYPE count as no data (no fabricated absence)', () => {
  const p = badPayloads();
  p.repo = baseRepo({ license: { spdx_id: 'MIT' } });
  p.community = []; // array, not an object — garbage, not "no license"
  const c = runChecks(buildFacts(p, { now: new Date() })).find((x) => x.id === 'license');
  assert.equal(c.status, 'pass'); // spdx from the repo payload still counts
});
