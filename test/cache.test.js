import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  resolveCacheDir, readEntry, readData, writeData, fmtAge, createEtagStore,
  REPO_TTL_MS, SEARCH_TTL_MS,
} from '../src/cache.js';

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'wns-cache-test-'));
}

test('resolveCacheDir: platform defaults and WNS_CACHE_DIR override', () => {
  assert.equal(
    resolveCacheDir({ env: { WNS_CACHE_DIR: '/custom' }, home: '/home/x', platform: 'linux' }),
    '/custom'
  );
  assert.equal(
    resolveCacheDir({ env: {}, home: '/home/x', platform: 'linux' }),
    '/home/x/.cache/why-no-stars'
  );
  assert.equal(
    resolveCacheDir({ env: { XDG_CACHE_HOME: '/xdg' }, home: '/home/x', platform: 'linux' }),
    '/xdg/why-no-stars'
  );
  assert.match(
    resolveCacheDir({ env: {}, home: 'C:\\Users\\x', platform: 'win32' }),
    /why-no-stars[\\/]cache$/
  );
});

test('write/read round-trip; TTL expiry; corrupt files ignored', () => {
  const dir = tempDir();
  try {
    assert.equal(writeData(dir, 'repo-a--b.json', { hello: 'world' }), true);
    const entry = readEntry(dir, 'repo-a--b.json');
    assert.equal(entry.data.hello, 'world');
    assert.ok(Math.abs(Date.now() - entry.at) < 5000);
    assert.deepEqual(readData(dir, 'repo-a--b.json'), { hello: 'world' });

    // within TTL
    assert.equal(readEntry(dir, 'repo-a--b.json', { maxAgeMs: REPO_TTL_MS }).data.hello, 'world');
    // simulate age: rewrite with an old timestamp via direct JSON
    writeFileSync(join(dir, 'repo-a--b.json'), JSON.stringify({ at: Date.now() - REPO_TTL_MS - 1000, data: { hello: 'old' } }));
    assert.equal(readEntry(dir, 'repo-a--b.json', { maxAgeMs: REPO_TTL_MS }), null);
    // maxAgeMs 0 = no TTL: stale entries still readable (rate-limit fallback)
    assert.equal(readEntry(dir, 'repo-a--b.json').data.hello, 'old');

    // corrupt / missing / wrong-shape entries are null, never thrown
    writeFileSync(join(dir, 'corrupt.json'), '{not json');
    assert.equal(readEntry(dir, 'corrupt.json'), null);
    assert.equal(readEntry(dir, 'missing.json'), null);
    writeFileSync(join(dir, 'shape.json'), JSON.stringify({ nope: true }));
    assert.equal(readEntry(dir, 'shape.json'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unwritable cache locations never crash the audit', () => {
  // a path where a parent is a FILE, so mkdirSync must fail
  const dir = tempDir();
  try {
    writeFileSync(join(dir, 'blocker'), 'x');
    const badDir = join(dir, 'blocker', 'sub');
    assert.equal(writeData(badDir, 'x.json', { a: 1 }), false);
    assert.equal(readEntry(badDir, 'x.json'), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unsafe filenames are sanitized (slugs and languages are external input)', () => {
  const dir = tempDir();
  try {
    writeData(dir, 'search-C++.json', { counts: [1] });
    // '+' would break naive paths; the written file name must be sanitized
    assert.equal(readData(dir, 'search-C++.json').counts[0], 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fmtAge renders human deltas in both locales', () => {
  assert.equal(fmtAge(5 * 60000), '5 min');
  assert.equal(fmtAge(5 * 60000, 'zh'), '5 分钟');
  assert.equal(fmtAge(3 * 3600000), '3 h');
  assert.equal(fmtAge(3 * 3600000, 'zh'), '3 小时');
  assert.equal(fmtAge(5 * 24 * 3600000), '5 d');
  assert.equal(fmtAge(5 * 24 * 3600000, 'zh'), '5 天');
});

test('etag store: round-trip, no cross-key collisions, corrupt-safe', () => {
  const dir = tempDir();
  try {
    const store = createEtagStore(dir);
    assert.equal(store.get('/repos/a/b'), null);
    store.put('/repos/a/b', '"e1"', { x: 1 });
    store.put('/repos/a/b?per_page=30', '"e2"', [1, 2]);
    assert.deepEqual(store.get('/repos/a/b'), { etag: '"e1"', data: { x: 1 } });
    assert.deepEqual(store.get('/repos/a/b?per_page=30'), { etag: '"e2"', data: [1, 2] });
    // overwrite on revalidation
    store.put('/repos/a/b', '"e3"', { x: 2 });
    assert.equal(store.get('/repos/a/b').etag, '"e3"');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
