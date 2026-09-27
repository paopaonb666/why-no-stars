// Record a real repo's API payloads as a test fixture.
// Usage: GITHUB_TOKEN=xxx node scripts/record-fixture.mjs sindresorhus/got
import { writeFileSync } from 'node:fs';
import { GitHubClient } from '../src/api.js';
import { fetchPayloads } from '../src/collect.js';

const slug = process.argv[2] ?? 'sindresorhus/got';
const [owner, name] = slug.replace(/^https?:\/\/github\.com\//, '').split('/');

const client = new GitHubClient();
console.error(`Fetching payloads for ${owner}/${name} …`);
const payloads = await fetchPayloads(client, owner, name, {});
const out = new URL('../test/fixtures/' + name + '.json', import.meta.url);
writeFileSync(out, JSON.stringify(payloads, null, 2));
console.error(`Wrote ${out.pathname} (${(JSON.stringify(payloads).length / 1024).toFixed(0)} KB)`);
