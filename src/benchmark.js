// Ecosystem benchmark: where does this repo's star count sit among all repos
// of the same primary language? We count repos per star bucket via the search
// API and report an honest percentile RANGE (you only know your bucket).
import { computePercentile } from './score.js';

export const BUCKETS = [
  { q: 'stars:0', label: { en: '0', zh: '0' } },
  { q: 'stars:1..9', label: { en: '1–9', zh: '1–9' } },
  { q: 'stars:10..99', label: { en: '10–99', zh: '10–99' } },
  { q: 'stars:100..999', label: { en: '100–999', zh: '100–999' } },
  { q: 'stars:1000..9999', label: { en: '1k–10k', zh: '1k–10k' } },
  { q: 'stars:>=10000', label: { en: '10k+', zh: '10k+' } },
];

export async function starPercentile(client, { stars, language }) {
  const langQ = language ? `+language:${encodeURIComponent(language)}` : '';
  const counts = [];
  try {
    for (const b of BUCKETS) {
      const r = await client.getSearch(
        `/search/repositories?q=${encodeURIComponent(b.q)}${langQ}&per_page=1`
      );
      counts.push(Number(r.total_count) || 0);
    }
  } catch {
    return null; // search rate-limited or error: benchmark is best-effort
  }
  const pct = computePercentile(counts, stars);
  return pct ? { ...pct, counts, language: language ?? null, stars } : null;
}
