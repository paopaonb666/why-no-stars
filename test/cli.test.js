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
});

test('finalExitCode: write failure beats the CI gate; gate fires only when set', () => {
  assert.equal(finalExitCode({ writeFailed: true, overall: 10, failUnder: 50 }), 1);
  assert.equal(finalExitCode({ writeFailed: false, overall: 49, failUnder: 50 }), 10);
  assert.equal(finalExitCode({ writeFailed: false, overall: 50, failUnder: 50 }), 0);
  assert.equal(finalExitCode({ writeFailed: false, overall: 10, failUnder: null }), 0);
  assert.equal(finalExitCode({ writeFailed: false, overall: null, failUnder: 50 }), 0);
});
