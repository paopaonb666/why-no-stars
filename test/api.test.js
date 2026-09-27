import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GitHubClient, RateLimitError, AuthError, NotFoundError, NetworkError, ApiError,
} from '../src/api.js';
import { fetchPayloads, buildFacts } from '../src/collect.js';
import { sanitize } from '../src/ansi.js';

// Minimal Response stand-in: { status, body, headers } -> what api.js reads.
function fakeFetch(routes) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    const path = url.replace(/^https:\/\/api\.github\.com/, '');
    const route = routes[path] ?? routes['*'];
    if (!route) throw new Error(`unexpected url in test: ${path}`);
    const { status = 200, body = {}, headers = {} } = typeof route === 'function' ? route(path, init) : route;
    const map = new Map(Object.entries({ 'content-type': 'application/json', ...headers }));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k) => map.get(k.toLowerCase()) ?? null },
      json: async () => body,
    };
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

function okRoutes(extra = {}) {
  return {
    '/repos/o/r': { body: { full_name: 'o/r', name: 'r', stargazers_count: 0 } },
    ...extra,
  };
}

test('client: token resolution — explicit > env > none', async () => {
  const f1 = fakeFetch(okRoutes());
  await new GitHubClient({ token: 't1', fetchImpl: f1 }).get('/repos/o/r');
  assert.equal(f1.calls[0].init.headers.Authorization, 'Bearer t1');

  const prev = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = 'env-token';
  try {
    const f2 = fakeFetch(okRoutes());
    await new GitHubClient({ fetchImpl: f2 }).get('/repos/o/r');
    assert.equal(f2.calls[0].init.headers.Authorization, 'Bearer env-token');
  } finally {
    if (prev === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = prev;
  }

  const f3 = fakeFetch(okRoutes());
  delete process.env.GH_TOKEN;
  await new GitHubClient({ fetchImpl: f3 }).get('/repos/o/r');
  assert.equal('Authorization' in f3.calls[0].init.headers, false);
});

test('client: identical paths are served from cache (one fetch)', async () => {
  const f = fakeFetch(okRoutes({ '/repos/o/r/stargazers': { body: [] } }));
  const c = new GitHubClient({ fetchImpl: f });
  const a = await c.get('/repos/o/r');
  const b = await c.get('/repos/o/r');
  assert.equal(f.calls.length, 1);
  assert.equal(a, b); // same object identity
  // distinct accept headers are distinct cache entries
  await c.get('/repos/o/r/stargazers', { accept: 'application/vnd.github.star+json' });
  assert.equal(f.calls.length, 2);
});
test('client: error mapping — 404/401/403/429/5xx', async () => {
  const cases = [
    [{ '/x': { status: 404 } }, NotFoundError],
    [{ '/x': { status: 401 } }, AuthError],
    [{ '/x': { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '123' } } }, RateLimitError],
    [{ '/x': { status: 429, headers: { 'x-ratelimit-remaining': '5' } } }, RateLimitError],
    [{ '/x': { status: 500 } }, ApiError],
  ];
  for (const [routes, expected] of cases) {
    await assert.rejects(
      new GitHubClient({ fetchImpl: fakeFetch(routes) }).get('/x'),
      (err) => err instanceof expected
    );
  }
  // 403 with quota left: forbidden, not rate-limit, message hints at secondary limits
  await assert.rejects(
    new GitHubClient({ fetchImpl: fakeFetch({ '/x': { status: 403, headers: { 'x-ratelimit-remaining': '42' } } }) }).get('/x'),
    (err) => !(err instanceof RateLimitError) && /secondary rate limit/.test(err.message)
  );
});

test('client: RateLimitError carries the reset timestamp', async () => {
  const routes = { '/x': { status: 403, headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' } } };
  await assert.rejects(
    new GitHubClient({ fetchImpl: fakeFetch(routes) }).get('/x'),
    (err) => err instanceof RateLimitError && err.resetMs === 1800000000000
  );
});

test('client: network failure and timeout become NetworkError (no raw stack)', async () => {
  // DNS-level failure: fetch rejects with a TypeError
  const offline = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(
    new GitHubClient({ fetchImpl: offline }).get('/repos/o/r'),
    (err) => err instanceof NetworkError && err.timedOut === false
  );
  // Real AbortSignal.timeout wiring: a fetch that hangs until the signal fires.
  // The keep-alive timer holds the event loop open — AbortSignal timers are
  // unref'd on some Node versions (22), which drains the loop mid-test and
  // leaves the test promise permanently pending.
  const keepAlive = setTimeout(() => {}, 1_000);
  const hanging = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  try {
    await assert.rejects(
      new GitHubClient({ fetchImpl: hanging, timeoutMs: 25 }).get('/repos/o/r'),
      (err) => err instanceof NetworkError && err.timedOut === true
    );
  } finally {
    clearTimeout(keepAlive);
  }
});

test('fetchPayloads: community profile fetch failed -> probes stay unknown', async () => {
  const routes = okRoutes({
    '/repos/o/r/languages': { body: { JavaScript: 10 } },
    '/repos/o/r/community/profile': { status: 404 },
    '/repos/o/r/contents': { body: [] },
    '/repos/o/r/tags?per_page=30': { body: [] },
    '/repos/o/r/releases?per_page=10': { body: [] },
    '/repos/o/r/contributors?per_page=100': { body: [] },
    '/repos/o/r/stargazers?per_page=100&page=1': { body: [] },
    '/repos/o/r/contents/package.json': { status: 404 },
    '/repos/o/r/readme': { status: 404 },
    '/repos/o/r/actions/workflows?per_page=100': { body: { total_count: 0, workflows: [] } },
    '/repos/o/r/events?per_page=100': { status: 404 },
  });
  const client = new GitHubClient({ fetchImpl: fakeFetch(routes) });
  const payloads = await fetchPayloads(client, 'o', 'r');
  assert.equal(payloads.community, null);
  assert.equal(payloads.issueTemplateProbe, 'unknown');
  assert.equal(payloads.securityProbe, 'unknown');
  const facts = buildFacts(payloads, { now: new Date() });
  assert.equal(facts.issueTemplateKnown, false);
  assert.equal(facts.securityPolicyKnown, false);
});

test('fetchPayloads: stale profile triggers probes; results are three-state', async () => {
  const routes = okRoutes({
    '/repos/o/r/languages': { body: { JavaScript: 10 } },
    '/repos/o/r/community/profile': { body: { files: {} } }, // profile claims nothing present
    '/repos/o/r/contents': { body: [] },
    '/repos/o/r/tags?per_page=30': { body: [] },
    '/repos/o/r/releases?per_page=10': { body: [] },
    '/repos/o/r/contributors?per_page=100': { body: [] },
    '/repos/o/r/stargazers?per_page=100&page=1': { body: [] },
    '/repos/o/r/contents/package.json': { status: 404 },
    '/repos/o/r/readme': { status: 404 },
    '/repos/o/r/actions/workflows?per_page=100': { body: { total_count: 0, workflows: [] } },
    '/repos/o/r/events?per_page=100': { status: 404 },
    '/repos/o/r/contents/.github/ISSUE_TEMPLATE': { body: [{ name: 'bug_report.md' }] }, // probe: present
    '/repos/o/r/contents/SECURITY.md': { status: 404 }, // probe: absent
  });
  const client = new GitHubClient({ fetchImpl: fakeFetch(routes) });
  const payloads = await fetchPayloads(client, 'o', 'r');
  assert.equal(payloads.issueTemplateProbe, 'known-present');
  assert.equal(payloads.securityProbe, 'known-absent');
  const facts = buildFacts(payloads, { now: new Date() });
  assert.equal(facts.issueTemplateKnown, true);
  assert.equal(facts.securityPolicyKnown, false);
});

// Flaky-fetch helpers: fail the first N calls, then succeed.
function flakyFetch(failTimes, failure, okBody = { fine: true }) {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls <= failTimes) return failure();
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => okBody };
  };
  fetchImpl.calls = () => calls;
  return fetchImpl;
}

test('client: retries a dead connection once, then succeeds', async () => {
  const fetchImpl = flakyFetch(1, () => { throw new TypeError('fetch failed'); });
  const data = await new GitHubClient({ fetchImpl, retryDelayMs: 0 }).get('/x');
  assert.deepEqual(data, { fine: true });
  assert.equal(fetchImpl.calls(), 2);
});

test('client: retries 503 once, then succeeds; 404 never retries', async () => {
  const flaky503 = flakyFetch(1, () => ({
    ok: false, status: 503, headers: { get: () => null }, json: async () => ({}),
  }));
  await new GitHubClient({ fetchImpl: flaky503, retryDelayMs: 0 }).get('/x');
  assert.equal(flaky503.calls(), 2);

  const fatal404 = flakyFetch(1, () => ({
    ok: false, status: 404, headers: { get: () => null }, json: async () => ({}),
  }));
  await assert.rejects(new GitHubClient({ fetchImpl: fatal404, retryDelayMs: 0 }).get('/x'), NotFoundError);
  assert.equal(fatal404.calls(), 1); // 4xx must not burn a second attempt
});

test('client: retries exhausted -> NetworkError with both attempts made', async () => {
  const fetchImpl = flakyFetch(99, () => { throw new TypeError('fetch failed'); });
  await assert.rejects(
    new GitHubClient({ fetchImpl, retryDelayMs: 0 }).get('/x'),
    (err) => err instanceof NetworkError && err.timedOut === false
  );
  assert.equal(fetchImpl.calls(), 2); // 1 initial + 1 retry (retries: 1 default)
});

test('sanitize: repo-controlled text cannot carry terminal escapes', () => {
  assert.equal(sanitize('\x1b[31mred\x1b[0m'), 'red');
  assert.equal(sanitize('\x1b[2J\x1b[3J'), ''); // clear-screen sequences removed whole
  assert.equal(sanitize('a\u0000b\u0007c'), 'a b c'); // control chars -> space
  assert.equal(sanitize('plain 中文 text'), 'plain 中文 text');
});

function etagFetch() {
  const state = { etag: '"abc123"', body: { value: 42 }, calls: 0 };
  const fetchImpl = async (url, init = {}) => {
    state.calls++;
    if (init.headers['If-None-Match'] === state.etag) {
      return { ok: false, status: 304, headers: { get: () => '5' }, json: async () => { throw new Error('304 must never be body-parsed'); } };
    }
    return { ok: true, status: 200, headers: { get: (k) => (k === 'etag' ? state.etag : null) }, json: async () => state.body };
  };
  fetchImpl.state = state;
  return fetchImpl;
}

function memoryStore() {
  const map = new Map();
  return {
    get: (k) => map.get(k) ?? null,
    put: (k, etag, data) => map.set(k, { etag, data }),
  };
}

test('client: etagStore revalidates (304) at zero quota cost', async () => {
  const f = etagFetch();
  const store = memoryStore();
  assert.deepEqual(await new GitHubClient({ fetchImpl: f, etagStore: store }).get('/x'), { value: 42 });
  assert.equal(f.state.calls, 1); // 200, etag stored
  // a fresh client (simulated next run) revalidates: 304, stored body served
  const c2 = new GitHubClient({ fetchImpl: f, etagStore: store });
  assert.deepEqual(await c2.get('/x'), { value: 42 });
  assert.equal(c2.conditionalHits, 1);
  assert.equal(f.state.calls, 2);
  // in-memory cache still short-circuits within one client
  await c2.get('/x');
  assert.equal(f.state.calls, 2);
});

test('client: changed resource returns fresh 200 and refreshes the etag', async () => {
  const f = etagFetch();
  const store = memoryStore();
  await new GitHubClient({ fetchImpl: f, etagStore: store }).get('/x');
  f.state.etag = '"new-etag"';
  f.state.body = { value: 43 };
  const c2 = new GitHubClient({ fetchImpl: f, etagStore: store });
  assert.deepEqual(await c2.get('/x'), { value: 43 });
  assert.equal(c2.conditionalHits, 0);
  assert.deepEqual(store.get('/x').data, { value: 43 });
});

test('client: no etagStore -> no If-None-Match, plain behavior', async () => {
  const f = etagFetch();
  assert.deepEqual(await new GitHubClient({ fetchImpl: f }).get('/x'), { value: 42 });
  assert.deepEqual(await new GitHubClient({ fetchImpl: f }).get('/x'), { value: 42 });
  assert.equal(f.state.calls, 2); // two plain 200s, no 304 path
});
