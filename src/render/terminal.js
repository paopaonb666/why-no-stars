// Terminal scorecard renderer. CJK-width aware, color-aware.
import { bold, dim, gray, green, yellow, red, cyan, padEnd, padStart, vwidth, useColor, sanitize } from '../ansi.js';
import { fmtAge } from '../cache.js';

export function T(x, lang) {
  if (x == null) return '';
  const s = typeof x === 'string' ? x : x[lang] ?? x.en ?? '';
  // Single sanitization boundary for every rendered string (repo-controlled
  // text must not smuggle escape sequences into the report).
  return sanitize(s);
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

export function renderTerminal({ facts, scorecard, benchmark, locale, delta = null, stale = false }) {
  const f = facts;
  const out = [];
  const push = (line = '') => out.push(line);
  // Rule lines shrink for narrow terminals (non-TTY keeps the 64-col design).
  const ruleW = Math.min(64, Math.max(30, process.stdout?.columns || 64));

  push(bold('why-no-stars') + gray(' · ') + bold(T({ en: 'Repo Scorecard', zh: '仓库体检报告' }, locale)));
  push(gray('─'.repeat(ruleW)));
  const tags = [
    f.isArchived ? red(T({ en: 'ARCHIVED', zh: '已归档' }, locale)) : null,
    f.isFork ? yellow(T({ en: 'FORK', zh: 'FORK' }, locale)) : null,
  ].filter(Boolean);
  push(
    bold(f.fullName) +
      gray(`  ★ ${fmtNum(f.stars)}  ·  ${f.language ?? '?'}  ·  `) +
      T({ en: 'pushed ', zh: '最近提交 ' }, locale) + gray(relativeDays(f.pushedAt, f.now, locale)) +
      (tags.length ? gray('  ·  ') + tags.join(gray(' · ')) : '')
  );
  if (f.isArchived) {
    push(gray(T({ en: '  Archived repo: scores measure presentation only; fixes that require pushing are omitted.', zh: '  已归档仓库：分数仅衡量页面呈现；需要推送代码的修复建议已省略。' }, locale)));
  }
  if (stale) {
    push(yellow(T({ en: '  ⚠ STALE DATA: rate-limited, so this report renders cached data — not a live audit.', zh: '  ⚠ 数据非实时：因限流改用本地缓存生成，本报告并非实时审计结果。' }, locale)));
  }
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
    // The 0-bucket swamps the range for tiny repos; give them the context the
    // range alone can't carry.
    if (f.stars <= 9 && benchmark.share0 > 50) {
      const ml = T(benchmark.medianLabel, locale);
      line2 += locale === 'zh'
        ? gray(`  ·  ${(benchmark.share0).toFixed(0)}% 的同类仓库为 0 star，中位数仓库：${ml}`)
        : gray(`  ·  ${(benchmark.share0).toFixed(0)}% of peers have 0 stars; median peer: ${ml}`);
    }
  }
  push(line1);
  if (delta) push(gray(deltaLine(delta, scorecard.overall, locale)));
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
        padStart(String(p.score), 3) + gray(`  (w ${p.weight} · ${p.checks.length} ${T({ en: 'checks', zh: '项' }, locale)})`)
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
    gray('─'.repeat(ruleW)) +
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

// Run-over-run delta line: what the score did since the user's last audit.
function deltaLine(delta, overall, locale) {
  const zh = locale === 'zh';
  const diff = overall - delta.previousOverall;
  const ago = fmtAge(Date.now() - delta.previousAt, locale);
  if (diff === 0) return zh ? `  · 与 ${ago}前的运行持平（${delta.previousOverall}）` : `  · unchanged vs your run ${ago} ago (${delta.previousOverall})`;
  const arrow = diff > 0 ? '▲' : '▼';
  const sign = diff > 0 ? `+${diff}` : `${diff}`;
  return zh
    ? `  ${arrow} ${sign} 分（${ago}前：${delta.previousOverall}）`
    : `  ${arrow} ${sign} pts (your run ${ago} ago: ${delta.previousOverall})`;
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
