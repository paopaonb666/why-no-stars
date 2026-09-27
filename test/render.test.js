import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacts } from '../src/collect.js';
import { runChecks } from '../src/checks/index.js';
import { scoreChecks } from '../src/score.js';
import { renderSvg } from '../src/render/svg.js';
import { renderMarkdown } from '../src/render/markdown.js';
import { renderTerminal } from '../src/render/terminal.js';
import { setColorMode } from '../src/ansi.js';

setColorMode('never');

function payloads() {
  return {
    repo: {
      full_name: 'me/demo', name: 'demo', owner: { login: 'me' },
      description: 'A demo <repo> & more', topics: ['cli'], homepage: 'https://x.example',
      stargazers_count: 47, forks_count: 3, subscribers_count: 5, open_issues_count: 2,
      fork: false, archived: false, pushed_at: '2026-09-20T00:00:00Z',
      created_at: '2026-06-01T00:00:00Z', language: 'Rust', license: { name: 'MIT' },
      has_discussions: true,
    },
    languages: { Rust: 9000, Shell: 1000 },
    community: { files: { license: { name: 'MIT' }, contributing: 'CONTRIBUTING.md' } },
    contents: [{ name: 'src', type: 'dir' }, { name: 'examples', type: 'dir' }, { name: 'Cargo.toml', type: 'file' }],
    tags: [{ name: 'v1.2.3' }],
    releases: [{ name: 'v1', tag_name: 'v1.2.3', published_at: '2026-09-01T00:00:00Z' }],
    contributors: [{ login: 'a' }, { login: 'b' }],
    stargazers: Array.from({ length: 5 }, (_, i) => ({ starred_at: `2026-09-1${i + 5}T00:00:00Z` })),
    events: [],
    packageJson: null,
    readme: {
      encoding: 'base64',
      content: Buffer.from('# demo\n\nA demo repo.\n\n## Install\n\n```bash\ncargo add demo\n```\n' + 'more text\n'.repeat(60)).toString('base64'),
    },
    workflows: { total_count: 2, workflows: [{ name: 'CI' }] },
    langOverride: null,
  };
}

function setup(locale = 'en') {
  const facts = buildFacts(payloads(), { now: new Date('2026-09-27T00:00:00Z') });
  const checks = runChecks(facts);
  const scorecard = scoreChecks(checks);
  const benchmark = {
    index: 2, total: 10000, before: 4000, through: 7000,
    lowerPct: 40, upperPct: 70, counts: [1000, 3000, 3000, 2000, 800, 200],
    language: 'Rust', stars: 47,
  };
  return { facts, scorecard, benchmark, locale };
}

test('SVG scorecard contains the essentials; percentile is an honest range', () => {
  const svg = renderSvg(setup());
  assert.ok(svg.includes('me/demo'));
  assert.ok(svg.includes('★ 47'));
  assert.ok(svg.includes('more stars than 40–70% of Rust repos'));
  assert.equal(svg.startsWith('<svg'), true);
  // a repo at the very top of the ecosystem still gets an honest range
  const nearTop = renderSvg(setupWith({ lowerPct: 99.99, upperPct: 99.997 }));
  assert.ok(nearTop.includes('more stars than 99–100% of Rust repos'));
});

function setupWith(benchOverride) {
  const s = setup();
  s.benchmark = { ...s.benchmark, ...benchOverride };
  return s;
}

test('SVG escapes interpolated text (a raw < would break the XML document)', () => {
  const s = setup();
  s.facts.fullName = 'me/<b>&x';
  const svg = renderSvg(s);
  assert.ok(svg.includes('me/&lt;b&gt;&amp;x'));
  assert.ok(!svg.includes('me/<b>'));
});

test('Markdown report is paste-ready', () => {
  const md = renderMarkdown(setup());
  assert.ok(md.includes('# 🩺 me/demo scorecard'));
  assert.ok(md.includes('| Pillar | Score | Weight |'));
  assert.ok(md.includes('why-no-stars'));
});

test('terminal renderer handles zh locale and CJK width without crash', () => {
  const out = renderTerminal(setup('zh'));
  assert.ok(out.includes('总分'));
  assert.ok(out.includes('最值得先做的三件事'));
});

test('terminal renderer English output', () => {
  const out = renderTerminal(setup('en'));
  assert.ok(out.includes('Overall'));
  assert.ok(out.includes('Top fixes'));
});

test('repo-controlled escape sequences never reach the rendered reports', () => {
  const s = setup();
  s.facts.description = 'A demo \x1b[31m<repo>\x1b[0m & more\u0007';
  for (const rendered of [
    renderTerminal(s),
    renderMarkdown(s),
    renderSvg(s),
  ]) {
    assert.ok(!rendered.includes('\x1b'), 'raw ESC reached the output');
    assert.ok(!rendered.includes('\u0007'), 'control char reached the output');
  }
  // the visible text survives (markdown shows evidence rows for every check)
  assert.ok(renderMarkdown(s).includes('A demo <repo> & more'));
});
