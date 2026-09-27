// Shareable SVG scorecard (1200x630, OG-image sized, GitHub-dark palette).
import { T, fmtNum, fmtTopEn, fmtTopZh } from './terminal.js';
import { sanitize } from '../ansi.js';

function esc(s) {
  return sanitize(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function colorFor(score) {
  if (score >= 80) return '#3fb950';
  if (score >= 60) return '#d29922';
  if (score >= 40) return '#db6d28';
  return '#f85149';
}

export function renderSvg({ facts, scorecard, benchmark, locale }) {
  const f = facts;
  const W = 1200;
  const H = 630;
  const zh = locale === 'zh';
  const accent = colorFor(scorecard.overall);
  const FONT = 'Segoe UI, PingFang SC, Microsoft YaHei, sans-serif';

  // Vertical rhythm (baselines): name 84, meta 124, benchmark 166,
  // big score 300, /100 336, grade chip 220-300, pillars 356..556, footer 608.
  const pillarTop = 356;
  const pillarStep = 40;

  const pillarRows = scorecard.pillars
    .filter((p) => p.score !== null)
    .map((p, i) => {
      const y = pillarTop + i * pillarStep;
      const barW = 300;
      const fill = (p.score / 100) * barW;
      const c = colorFor(p.score);
      return `
    <text x="90" y="${y}" font-family="${FONT}" font-size="21" fill="#c9d1d9">${esc(T(p.name, locale))}</text>
    <rect x="430" y="${y - 14}" width="${barW}" height="13" rx="6.5" fill="#21262d"/>
    <rect x="430" y="${y - 14}" width="${fill.toFixed(1)}" height="13" rx="6.5" fill="${c}"/>
    <text x="752" y="${y}" font-family="${FONT}" font-size="21" fill="${c}">${p.score}</text>`;
    })
    .join('');

  let benchLine = '';
  if (benchmark) {
    benchLine = zh
      ? `生态分位：${fmtTopZh(benchmark)}（${f.language ?? 'GitHub'}）`
      : `Ecosystem: ${fmtTopEn(benchmark)} of ${f.language ?? 'GitHub'} repos`;
    if (f.stars <= 9 && benchmark.share0 > 50) {
      const ml = T(benchmark.medianLabel, locale);
      benchLine += zh
        ? ` · ${(benchmark.share0).toFixed(0)}% 的同类仓库为 0 star，中位数仓库：${ml}`
        : ` · ${(benchmark.share0).toFixed(0)}% of peers have 0 stars; median peer: ${ml}`;
    }
  } else {
    benchLine = zh
      ? `${scorecard.stats.passed}/${scorecard.stats.total} 项检查通过`
      : `${scorecard.stats.passed}/${scorecard.stats.total} checks passed`;
  }

  const gradeLabel = zh ? `评级 ${scorecard.grade}` : `Grade ${scorecard.grade}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d1117"/>
      <stop offset="1" stop-color="#101828"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="1" stop-color="#58a6ff"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="0" y="0" width="${W}" height="6" fill="url(#accent)"/>
  <circle cx="1120" cy="90" r="150" fill="${accent}" opacity="0.06"/>
  <circle cx="90" cy="610" r="190" fill="#58a6ff" opacity="0.05"/>

  <text x="90" y="84" font-family="${FONT}" font-size="40" font-weight="700" fill="#e6edf3">${esc(f.fullName)}</text>
  <text x="90" y="124" font-family="${FONT}" font-size="22" fill="#8b949e">★ ${fmtNum(f.stars)}   ·   ${esc(f.language ?? '?')}   ·   ${esc(gradeLabel)}${f.isArchived ? '   ·   ARCHIVED' : ''}${f.isFork ? '   ·   FORK' : ''}</text>
  <text x="90" y="166" font-family="${FONT}" font-size="20" fill="#58a6ff">${esc(benchLine)}</text>

  <text x="90" y="300" font-family="${FONT}" font-size="110" font-weight="800" fill="${accent}">${scorecard.overall}</text>
  <text x="90" y="336" font-family="${FONT}" font-size="24" fill="#8b949e">/100 ${zh ? '总分' : 'overall'}</text>

  <rect x="340" y="220" width="86" height="86" rx="18" fill="${accent}" opacity="0.15"/>
  <text x="383" y="279" text-anchor="middle" font-family="${FONT}" font-size="52" font-weight="800" fill="${accent}">${esc(scorecard.grade)}</text>

  ${pillarRows}

  <text x="90" y="608" font-family="${FONT}" font-size="19" fill="#8b949e">why-no-stars · ${zh ? 'star 不是玄学，是前 10 秒的功夫。' : 'stars aren’t luck. they’re the first 10 seconds, done right.'}   npx why-no-stars &lt;owner/repo&gt;</text>
</svg>
`;
}
