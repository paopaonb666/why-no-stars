// Terminal scorecard renderer. CJK-width aware, color-aware.
import { bold, dim, gray, green, yellow, red, cyan, padEnd, padStart, vwidth, useColor } from '../ansi.js';

export function T(x, lang) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  return x[lang] ?? x.en ?? '';
}

export function fmtNum(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
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

export function renderTerminal({ facts, scorecard, benchmark, locale }) {
  const f = facts;
  const out = [];
  const push = (line = '') => out.push(line);

  push(bold('why-no-stars') + gray(' · ') + bold(T({ en: 'Repo Scorecard', zh: '仓库体检报告' }, locale)));
  push(gray('─'.repeat(64)));
  push(
    bold(f.fullName) +
      gray(`  ★ ${fmtNum(f.stars)}  ·  ${f.language ?? '?'}  ·  `) +
      T({ en: 'pushed ', zh: '最近提交 ' }, locale) + gray(relativeDays(f.pushedAt, f.now, locale))
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
        ? `生态分位：${fmtTopZh(benchmark)}（${f.language ?? 'GitHub'}）`
        : `Ecosystem: ${fmtTopEn(benchmark)} of ${f.language ?? 'GitHub'} repos`);
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
    const impactLabel = { high: ['HIGH', '高'], medium: ['MED', '中'], low: ['LOW', '低'] };
    scorecard.quickWins.forEach((c, i) => {
      const [enL, zhL] = impactLabel[c.impact] ?? impactLabel.low;
      const styled = c.impact === 'high' ? red(enL) : c.impact === 'medium' ? yellow(enL) : gray(enL);
      push(`  ${bold(String(i + 1))}. [${locale === 'zh' ? zhL : styled}] ${bold(T(c.title, locale))}`);
      if (c.detail) push('     ' + gray(T(c.detail, locale)));
      if (c.fix) push('     ' + cyan('→ ' + T(c.fix, locale)));
    });
    push();
  }

  // All checks — every check, including skips (skips are invisible in the
  // pillar scores above but users deserve to see what wasn't evaluated).
  push('  ' + bold(T({ en: `All checks (${scorecard.allChecks.length})`, zh: `全部检查项（${scorecard.allChecks.length}）` }, locale)));
  for (const p of scorecard.pillars) {
    const mine = scorecard.allChecks.filter((c) => c.pillar === p.id);
    if (!mine.length) continue;
    push('  ' + gray(`· ${T(p.name, locale)}`));
    for (const c of mine) {
      const icon = ICONS[c.status](useColor());
      const status =
        c.status === 'pass'
          ? green(T({ en: 'PASS', zh: '通过' }, locale))
          : c.status === 'warn'
            ? yellow(T({ en: 'WARN', zh: '警告' }, locale))
            : c.status === 'fail'
              ? red(T({ en: 'FAIL', zh: '未过' }, locale))
              : gray(T({ en: 'SKIP', zh: '跳过' }, locale));
      push(`    ${icon} ${status}  ${T(c.title, locale)}`);
      if (c.status !== 'pass' && c.status !== 'skip' && c.detail) {
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

// One honest metric everywhere: the share of same-language repos you beat.
// "more stars than 99–100%" for giants, "more stars than 0–90%" for the
// 0-star floor — the wide range IS the honest answer. Callers append the peer group.
export function fmtTopEn(b) {
  const lo = Math.floor(b.lowerPct);
  const hi = Math.min(100, Math.ceil(b.upperPct));
  return `more stars than ${lo}–${hi}%`;
}

export function fmtTopZh(b) {
  const lo = Math.floor(b.lowerPct);
  const hi = Math.min(100, Math.ceil(b.upperPct));
  return `star 数超过同类仓库的 ${lo}–${hi}%`;
}

function relativeDays(iso, now, locale = 'en') {
  const zh = locale === 'zh';
  if (!iso) return zh ? '未知' : '?';
  const days = Math.max(0, Math.round((now - new Date(iso)) / 86400000));
  if (days === 0) return zh ? '今天' : 'today';
  if (days === 1) return zh ? '1 天前' : '1d ago';
  if (days < 60) return zh ? `${days} 天前` : `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 24) return zh ? `${months} 个月前` : `${months}mo ago`;
  return zh ? `${Math.round(months / 12)} 年前` : `${Math.round(months / 12)}y ago`;
}
