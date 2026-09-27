import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, parseSlug, UsageError, main, nodeMajor } from '../src/cli.js';

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
