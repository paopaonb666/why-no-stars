import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacts } from '../src/collect.js';
import { runChecks } from '../src/checks/index.js';
import { scoreChecks } from '../src/score.js';
import { renderSvg, fitText } from '../src/render/svg.js';
import { renderMarkdown } from '../src/render/markdown.js';
import { renderTerminal, fmtTopEn, fmtTopZh } from '../src/render/terminal.js';
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
  assert.ok(out.includes('最值得先做的几件事'));
});

test('terminal renderer English output', () => {
  const out = renderTerminal(setup('en'));
  assert.ok(out.includes('Overall'));
  assert.ok(out.includes('Top fixes'));
});

test('repo-controlled escape sequences never reach the rendered reports', () => {
  const p = payloads();
  p.repo.description = 'A demo \x1b[31m<repo>\x1b[0m & more\u0007';
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const scorecard = scoreChecks(runChecks(facts));
  for (const rendered of [
    renderTerminal({ facts, scorecard, benchmark: null, locale: 'en' }),
    renderMarkdown({ facts, scorecard, benchmark: null, locale: 'en' }),
    renderSvg({ facts, scorecard, benchmark: null, locale: 'en' }),
  ]) {
    assert.ok(!rendered.includes('\x1b'), 'raw ESC reached the output');
    assert.ok(!rendered.includes('\u0007'), 'control char reached the output');
  }
  // the visible text survives (markdown shows evidence rows for every check)
  assert.ok(
    renderMarkdown({ facts, scorecard, benchmark: null, locale: 'en' }).includes('A demo <repo> & more')
  );
});

test('markdown: a literal backslash-pipe in repo text cannot split the table row', () => {
  const p = payloads();
  p.repo.description = 'a \\| b'; // actual chars: a, space, backslash, pipe, space, b
  const facts = buildFacts(p, { now: new Date('2026-09-27T00:00:00Z') });
  const scorecard = scoreChecks(runChecks(facts));
  const md = renderMarkdown({ facts, scorecard, benchmark: null, locale: 'en' });
  // backslash escaped first, then the pipe -> "\\\|": CommonMark un-escapes
  // to a literal "\|" instead of a cell boundary
  assert.ok(md.includes('a \\\\\\| b'), 'expected backslash-escaped pipe in the cell');
  // the evidence row still has exactly 4 unescaped pipes (4-column table)
  const row = md.split('\n').find((l) => l.startsWith('|') && l.includes('Repo description'));
  const unescapedPipes = (row.match(/(^|[^\\])\|/g) ?? []).length;
  assert.equal(unescapedPipes, 4);
});

test('stale flag renders a warning banner in every sharing format', () => {
  const s = setup();
  s.stale = true;
  const md = renderMarkdown(s);
  assert.ok(md.includes('STALE DATA'));
  assert.ok(md.startsWith('> ⚠️'));
  const svg = renderSvg(s);
  assert.ok(svg.includes('STALE DATA'));
  assert.ok(svg.includes('#d29922'));
  // default: no banner
  assert.ok(!renderMarkdown(setup()).includes('STALE DATA'));
  assert.ok(!renderSvg(setup()).includes('STALE DATA'));
});

test('fmtTop: sub-1% upper bounds render one decimal, never "0–0%"', () => {
  // GitHub's search index lags new repos: own bucket and below can be all 0
  const b = { lowerPct: 0, upperPct: 0.4 };
  assert.equal(fmtTopEn(b), 'more stars than 0.4%');
  assert.equal(fmtTopZh(b), 'star 数超过同类仓库的 0.4%');
  // normal ranges keep the integer format
  assert.equal(fmtTopEn({ lowerPct: 40, upperPct: 70 }), 'more stars than 40–70%');
});

test('quickWins render recovered points, not a static label that could contradict order', () => {
  const out = renderTerminal(setup('en'));
  assert.ok(/\[\+\d+\.\d pts\]/.test(out), 'expected [+X.X pts] in the Top fixes list');
  const md = renderMarkdown(setup());
  assert.ok(/\+\d+\.\d pts/.test(md));
});

test('fitText: shrinks, then truncates with an ellipsis; short text untouched', () => {
  // short text: untouched at base size
  assert.deepEqual(fitText('me/demo', 1020, 40, 24), { text: 'me/demo', size: 40 });
  // absurdly long latin name: shrink to min, then truncate
  const long = fitText('a'.repeat(120), 400, 40, 14);
  assert.equal(long.size, 14);
  assert.ok(long.text.endsWith('…'));
  assert.ok(long.text.length < 120);
  // CJK shrinks faster (full-width chars): 40 CJK chars are ~1600px at 40
  const cjk = fitText('仓'.repeat(40), 800, 40, 20);
  assert.ok(cjk.size < 40 || cjk.text.endsWith('…'));
  assert.ok(cjk.size >= 20);
});

test('SVG: oversized repo names are fitted, never overflowing the card', () => {
  const s = setup();
  s.facts.fullName = `${'super-long-repo-name-'.repeat(8)}/x`;
  const svg = renderSvg(s);
  assert.ok(svg.includes('…')); // truncated rather than overflowing
  assert.ok(!svg.includes(s.facts.fullName)); // full name not rendered raw
  // normal names render at full size with no ellipsis
  const normal = renderSvg(setup());
  assert.ok(normal.includes('font-size="40"'));
  assert.ok(!normal.includes('…'));
});
