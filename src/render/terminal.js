// Terminal scorecard renderer. CJK-width aware, color-aware.
import { bold, dim, gray, green, yellow, red, cyan, padEnd, padStart, vwidth } from '../ansi.js';

export function T(x, lang) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return x[lang] ?? x.en ?? '';
}

const ICONS = {
  pass: (s) => (s ? green('✓') : '✓'),
  warn: (s) => (s ? yellow('!') : '!'),
  fail: (s) => (s ? red('✗') : '✗'),
  skip: (s) => (s ? dim('-') : '-'),
};

function scoreColor(score) {
  return score >= 80 ? green : score >= 60 ? yellow : red;
}

function bar(score, width = 10) {
  const filled = Math.round((score / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function fmtNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export function renderTerminal({ facts, scorecard, benchmark, locale }) {
  const f = facts;
  const out = [];
  const push = (line = '') => out.push(line);

  push(bold('why-no-stars') + gray(' · ') + bold(T({ en: 'Repo Scorecard', zh: '仓库体检报告' }, locale)));
  push(gray('─'.repeat(64)));
  push(
    bold(f.fullName) +
      gray(`  ★ ${fmtNum(f.stars)}  ·  ${f.language ?? '?'}  ·  `) +
      T({ en: 'pushed ', zh: '最近提交 ' }, locale) + gray(relativeDays(f.pushedAt, f.now))
  );
  push();

  // Overall + percentile
  const sc = scoreColor(scorecard.overall);
  const line1 =
    '  ' + bold(T({ en: 'Overall', zh: '总分' }, locale)) + '  ' +
    sc(`${scorecard.overall}/100`) + '  ' + sc(`[${scorecard.grade}]`);
  let line2 = '';
  if (benchmark) {
    line2 =
      '  ' +
      (locale === 'zh'
        ? `生态分位：${fmtTopZh(benchmark)} 的 ${f.language ?? 'GitHub'} 仓库`
        : `Star percentile: ${fmtTopEn(benchmark)} of ${f.language ?? 'GitHub'} repos`);
  }
  push(line1);
  if (line2) push(gray(line2));
  push();

  // Pillars
  const nameWidth = Math.max(
    ...scorecard.pillars.map((p) => vwidth(T(p.name, locale)))
  );
  for (const p of scorecard.pillars) {
    if (p.score === null) continue;
    const label = T(p.name, locale);
    const c = scoreColor(p.score);
    push(
      '  ' +
        padEnd(label, nameWidth) +
        '  ' + c(bar(p.score)) + '  ' +
        padStart(String(p.score), 3) + gray(`  (w ${p.weight})`)
    );
  }
  push();

  // Quick wins
  if (scorecard.quickWins.length) {
    push('  ' + bold(`⚡ ${T({ en: 'Top fixes', zh: '最值得先做的三件事' }, locale)}`));
    scorecard.quickWins.forEach((c, i) => {
      const impact = c.impact === 'high' ? red('HIGH') : c.impact === 'medium' ? yellow('MED ') : gray('LOW ');
      push(`  ${bold(String(i + 1))}. [${impact}] ${bold(T(c.title, locale))}`);
      if (c.detail) push('     ' + gray(T(c.detail, locale)));
      if (c.fix) push('     ' + cyan('→ ' + T(c.fix, locale)));
    });
    push();
  }

  // All checks
  push('  ' + bold(T({ en: `All checks (${scorecard.stats.total})`, zh: `全部检查项（${scorecard.stats.total}）` }, locale)));
  for (const p of scorecard.pillars) {
    const mine = p.checks;
    if (!mine.length) continue;
    push('  ' + gray(`· ${T(p.name, locale)}`));
    for (const c of mine) {
      const icon = ICONS[c.status](useColorSafe());
      const status =
        c.status === 'pass'
          ? green(T({ en: 'PASS', zh: '通过' }, locale))
          : c.status === 'warn'
            ? yellow(T({ en: 'WARN', zh: '警告' }, locale))
            : c.status === 'fail'
              ? red(T({ en: 'FAIL', zh: '未过' }, locale))
              : gray(T({ en: 'SKIP', zh: '跳过' }, locale));
      push(`    ${icon} ${status}  ${T(c.title, locale)}`);
      if (c.status !== 'pass' && c.detail) {
        push('         ' + gray(T(c.detail, locale)));
      }
    }
  }
  push();
  push(
    gray('─'.repeat(64)) +
      gray(`  why-no-stars · ${T({ en: 'stars aren’t luck.', zh: 'star 不是玄学，是前 10 秒的功夫。' }, locale)} npx why-no-stars <owner/repo>`)
  );
  return out.join('\n');
}

function useColorSafe() {
  try {
    return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  } catch {
    return false;
  }
}

// "top 4–12%" for normal repos, "top <1%" for giants — never "top 0–0%".
export function fmtTopEn(b) {
  const lo = 100 - b.upperPct;
  const hi = 100 - b.lowerPct;
  if (hi < 1) return 'top <1%';
  return `top ${Math.max(1, Math.floor(lo))}–${Math.max(1, Math.ceil(hi))}%`;
}

export function fmtTopZh(b) {
  if (b.lowerPct > 99) return '前 <1%';
  return `前 ${(100 - b.upperPct).toFixed(0)}–${(100 - b.lowerPct).toFixed(0)}%`;
}

function relativeDays(iso, now) {
  if (!iso) return '?';
  const days = Math.max(0, Math.round((now - new Date(iso)) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 60) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
