import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseSlug, UsageError, main, nodeMajor, finalExitCode } from '../src/cli.js';

test('parseSlug: URLs, .git suffix, trailing slashes, case', () => {
  assert.deepEqual(parseSlug('a/b'), { owner: 'a', name: 'b' });
  assert.deepEqual(parseSlug('https://github.com/a/b'), { owner: 'a', name: 'b' });
  assert.deepEqual(parseSlug('https://github.com/a/b/'), { owner: 'a', name: 'b' });
  assert.deepEqual(parseSlug('a/b.git'), { owner: 'a', name: 'b' });
  assert.deepEqual(parseSlug('A/B.C'), { owner: 'A', name: 'B.C' });
  assert.equal(parseSlug('not-a-slug'), null);
  assert.equal(parseSlug(''), null);
  assert.equal(parseSlug(null), null);
  assert.equal(parseSlug('a/'), null);
});

test('parseArgs: value flags require and reject suspicious values', () => {
  assert.equal(parseArgs(['a/b', '--svg', 'out.svg']).svg, 'out.svg');
  assert.equal(parseArgs(['a/b', '--svg=out.svg']).svg, 'out.svg');
  assert.throws(() => parseArgs(['a/b', '--svg']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--json']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--svg', '--quiet']), UsageError); // swallows flags no more
  assert.throws(() => parseArgs(['a/b', '--unknown']), UsageError);
  assert.equal(parseArgs(['a/b', '--quiet']).quiet, true);
  assert.equal(parseArgs(['--zh', 'a/b']).locale, 'zh');
});

test('main: usage errors exit 1 without touching the network', async () => {
  assert.equal(await main([]), 1); // missing slug
  assert.equal(await main(['--help']), 0);
  assert.equal(await main(['--version']), 0);
  assert.equal(await main(['not-a-slug']), 1);
  assert.equal(await main(['a/b', '--svg']), 1); // flag value validation fires first
  assert.equal(await main(['a/b', '--nope']), 1);
});

test('nodeMajor: parses Node version strings for the runtime guard', () => {
  assert.equal(nodeMajor('22.5.1'), 22);
  assert.equal(nodeMajor('18.0.0'), 18);
  assert.equal(nodeMajor('24.14.1'), 24);
  assert.equal(nodeMajor('garbage'), 0);
  assert.equal(nodeMajor(''), 0);
});

test('parseArgs: --fail-under accepts integers 0-100 only', () => {
  assert.equal(parseArgs(['a/b', '--fail-under', '70']).failUnder, 70);
  assert.equal(parseArgs(['a/b', '--fail-under=85']).failUnder, 85);
  assert.equal(parseArgs(['a/b', '--fail-under', '0']).failUnder, 0);
  assert.throws(() => parseArgs(['a/b', '--fail-under', 'abc']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--fail-under', '101']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--fail-under', '-1']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--fail-under', '3.5']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--fail-under']), UsageError);
  assert.throws(() => parseArgs(['a/b', '--fail-under=']), UsageError); // empty disables silently no more
  assert.throws(() => parseArgs(['a/b', '--md=']), UsageError); // empty output path rejected
  assert.throws(() => parseArgs(['a/b', '--svg', '']), UsageError);
});

test('finalExitCode: write failure beats the CI gate; gate fires only when set', () => {
  assert.equal(finalExitCode({ writeFailed: true, overall: 10, failUnder: 50 }), 1);
  assert.equal(finalExitCode({ writeFailed: false, overall: 49, failUnder: 50 }), 10);
  assert.equal(finalExitCode({ writeFailed: false, overall: 50, failUnder: 50 }), 0);
  assert.equal(finalExitCode({ writeFailed: false, overall: 10, failUnder: null }), 0);
  assert.equal(finalExitCode({ writeFailed: false, overall: null, failUnder: 50 }), 0);
});

// --- main() orchestration against a fully mocked global fetch ---

function gateFetch() {
  const repo = {
    full_name: 'o/r', name: 'r', owner: { login: 'o' },
    description: 'x'.repeat(20), topics: ['a', 'b', 'c'], homepage: null,
    stargazers_count: 38, forks_count: 1, subscribers_count: 1, open_issues_count: 0,
    fork: false, archived: false, pushed_at: '2026-09-25T00:00:00Z',
    created_at: '2026-08-01T00:00:00Z', language: 'JavaScript', license: { spdx_id: 'MIT' },
    has_discussions: false,
  };
  const routes = {
    '/repos/o/r': { body: repo },
    '/repos/o/r/languages': { body: { JavaScript: 10 } },
    '/repos/o/r/community/profile': { body: { files: {} } },
    '/repos/o/r/contents': { body: [] },
    '/repos/o/r/tags?per_page=30': { body: [] },
    '/repos/o/r/releases?per_page=10': { body: [] },
    '/repos/o/r/contributors?per_page=100': { body: [] },
    '/repos/o/r/stargazers?per_page=100&page=1': { body: [] },
    '/repos/o/r/contents/package.json': { status: 404 },
    '/repos/o/r/readme': { status: 404 },
    '/repos/o/r/actions/workflows?per_page=100': { body: { total_count: 0, workflows: [] } },
    '/repos/o/r/events?per_page=100': { status: 404 },
    '/repos/o/r/contents/.github/ISSUE_TEMPLATE': { status: 404 },
    '/repos/o/r/contents/SECURITY.md': { status: 404 },
  };
  return async (url) => {
    const path = url.replace(/^https:\/\/api\.github\.com/, '');
    const { status = 200, body = {}, headers = {} } = routes[path] ?? { status: 404 };
    const map = new Map(Object.entries(headers));
    return { ok: status < 300, status, headers: { get: (k) => map.get(k.toLowerCase()) ?? null }, json: async () => body };
  };
}

test('main: --fail-under gate actually drives the exit code (wiring, not just the helper)', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = gateFetch();
  try {
    // a thin repo scores well below 100 -> gate trips
    assert.equal(await main(['o/r', '--no-cache', '--no-benchmark', '--quiet', '--fail-under', '100']), 10);
    assert.equal(await main(['o/r', '--no-cache', '--no-benchmark', '--quiet', '--fail-under', '1']), 0);
    assert.equal(await main(['o/r', '--no-cache', '--no-benchmark', '--quiet']), 0);
  } finally {
    globalThis.fetch = orig;
  }
});

test('main: rate-limited fresh fetch falls back to stale cache, flagged stale in JSON', async () => {
  const { writeFileSync, readFileSync, mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'wns-stale-test-'));
  const prevCache = process.env.WNS_CACHE_DIR;
  process.env.WNS_CACHE_DIR = dir;
  const origFetch = globalThis.fetch;
  try {
    // Seed a valid, now-expired repo cache: populate once WITH cache, then age it.
    globalThis.fetch = gateFetch();
    await main(['o/r', '--no-benchmark', '--quiet']);
    const f = join(dir, 'repo-o--r.json');
    const entry = JSON.parse(readFileSync(f, 'utf8'));
    entry.at -= 31 * 60 * 1000; // past the 30-min TTL
    writeFileSync(f, JSON.stringify(entry));
    // Now every request is quota-exhausted -> RateLimitError -> stale fallback.
    globalThis.fetch = async () => ({
      ok: false, status: 403,
      headers: { get: (k) => (k === 'x-ratelimit-remaining' ? '0' : k === 'x-ratelimit-reset' ? '123' : null) },
      json: async () => ({}),
    });
    const logs = [];
    const origLog = console.log;
    console.log = (s) => logs.push(s);
    let code;
    try {
      code = await main(['o/r', '--no-benchmark', '--quiet', '--json', '-']);
    } finally {
      console.log = origLog;
    }
    assert.equal(code, 0);
    // logs[0] is the --quiet summary line; the JSON report is the last one
    const report = JSON.parse(logs[logs.length - 1]);
    assert.equal(report.stale, true);
    assert.equal(report.repo.fullName, 'o/r');
  } finally {
    globalThis.fetch = origFetch;
    if (prevCache === undefined) delete process.env.WNS_CACHE_DIR; else process.env.WNS_CACHE_DIR = prevCache;
    rmSync(dir, { recursive: true, force: true });
  }
});
