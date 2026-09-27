import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GitHubClient, RateLimitError, AuthError, NotFoundError, NetworkError,
} from '../src/api.js';
import { fetchPayloads, buildFacts } from '../src/collect.js';

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
    [{ '/x': { status: 500 } }, Error],
  ];
  for (const [routes, expected] of cases) {
    await assert.rejects(
      new GitHubClient({ fetchImpl: fakeFetch(routes) }).get('/x'),
      (err) => err instanceof expected || (expected === Error && err.constructor === Error)
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
  // Real AbortSignal.timeout wiring: a fetch that hangs until the signal fires
  const hanging = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(init.signal.reason));
  });
  await assert.rejects(
    new GitHubClient({ fetchImpl: hanging, timeoutMs: 25 }).get('/repos/o/r'),
    (err) => err instanceof NetworkError && err.timedOut === true
  );
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
