// Ecosystem benchmark: where does this repo's star count sit among all repos
// of the same primary language? We count repos per star bucket via the search
// API and report an honest percentile RANGE (you only know your bucket).
// The bottom of the range is split finer (0 / 1–2 / 3–9) because that's where
// most of this tool's users live — and where one wide bucket would say nothing.
import { computePercentile } from './score.js';

export const BUCKETS = [
  { q: 'stars:0', label: { en: '0', zh: '0' } },
  { q: 'stars:1..2', label: { en: '1–2', zh: '1–2' } },
  { q: 'stars:3..9', label: { en: '3–9', zh: '3–9' } },
  { q: 'stars:10..99', label: { en: '10–99', zh: '10–99' } },
  { q: 'stars:100..999', label: { en: '100–999', zh: '100–999' } },
  { q: 'stars:1000..9999', label: { en: '1k–10k', zh: '1k–10k' } },
  { q: 'stars:>=10000', label: { en: '10k+', zh: '10k+' } },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pure rebuild of the benchmark shape from bucket counts (used live and when
// the counts come from the cache).
export function percentileFromCounts(counts, { stars, language }) {
  const pct = computePercentile(counts, stars);
  if (!pct) return null;
  // Median peer: the bucket where the cumulative share crosses 50%. Clamped:
  // counts comes from computePercentile (exact 7 buckets), but the clamp
  // keeps a future drift from throwing on BUCKETS[medianIdx].
  let cum = 0;
  let medianIdx = 0;
  for (const [i, c] of counts.entries()) {
    cum += c;
    if (cum >= pct.total / 2) { medianIdx = i; break; }
  }
  medianIdx = Math.min(medianIdx, BUCKETS.length - 1);
  const share0 = pct.total ? (counts[0] / pct.total) * 100 : 0;
  return {
    ...pct,
    counts,
    medianIdx,
    medianLabel: BUCKETS[medianIdx].label,
    share0,
    language: language ?? null,
    stars,
  };
}

// staggerMs is injectable so tests can run without the real pacing. The 150ms
// stagger is defensive pacing for GitHub's *undocumented* search secondary
// limits (the documented 10-30 req/min caps comfortably fit a serial burst);
// a skipped benchmark is graceful, so we err on the safe side but keep the
// dead time to ~0.9s.
export async function starPercentile(client, { stars, language, staggerMs = 150 }) {
  const langQ = language ? `+language:${encodeURIComponent(language)}` : '';
  const counts = [];
  try {
    for (const [i, b] of BUCKETS.entries()) {
      if (i > 0 && staggerMs > 0) await sleep(staggerMs);
      const r = await client.getSearch(
        `/search/repositories?q=${encodeURIComponent(b.q)}${langQ}&per_page=1`
      );
      counts.push(Number(r.total_count) || 0);
    }
  } catch {
    return null; // search rate-limited or error: benchmark is best-effort
  }
  return percentileFromCounts(counts, { stars, language });
}
