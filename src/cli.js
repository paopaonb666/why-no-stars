// CLI entry: argument parsing, orchestration, friendly errors, exit codes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GitHubClient, RateLimitError, AuthError, NotFoundError, NetworkError, ApiError } from './api.js';
import { fetchPayloads, buildFacts } from './collect.js';
import { runChecks } from './checks/index.js';
import { scoreChecks } from './score.js';
import { starPercentile, percentileFromCounts } from './benchmark.js';
import { renderTerminal, fmtTopEn, fmtTopZh } from './render/terminal.js';
import { renderSvg } from './render/svg.js';
import { renderMarkdown } from './render/markdown.js';
import { setColorMode, dim } from './ansi.js';
import { resolveCacheDir, createEtagStore, readEntry, writeData, fmtAge, REPO_TTL_MS, SEARCH_TTL_MS } from './cache.js';
import { buildJsonReport } from './report.js';

const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;

const HELP = (locale) => (locale === 'zh' ? `
why-no-stars v${VERSION} — 诊断你的 GitHub 仓库为什么没人 star

用法:
  wns <owner/repo> [选项]

选项:
  --svg <file>     输出可分享的 SVG 评分卡（- 表示 stdout）
  --json <file>    输出机器可读的完整 JSON 报告（- 表示 stdout）
  --md <file>      输出 Markdown 报告，可直接贴到 issue/discussion（- 表示 stdout）
  --zh             用中文输出（默认自动检测）
  --en             用英文输出
  --lang <lang>    覆盖自动识别的主语言（用于生态分位对比）
  --token <token>  GitHub token（默认读 GITHUB_TOKEN / GH_TOKEN 环境变量）
  --no-benchmark   跳过生态分位对比（省 7 次 API 调用）
  --no-cache       跳过本地缓存与运行历史（仓库数据默认缓存 30 分钟）
  --fail-under <n> 分数低于 <n> 时以退出码 10 结束（用于 CI 门禁）
  --quiet          只打印一行总分
  --color          强制彩色输出
  --no-color       禁用彩色输出
  --version        打印版本
  --help           打印帮助

运行方式:
  npx github:paopaonb666/why-no-stars <owner/repo>

示例:
  wns sindresorhus/got
  wns me/my-project --svg scorecard.svg --zh
  wns https://github.com/expressjs/express --md report.md

无需 API key 也能跑；配置 GITHUB_TOKEN 可将限额从 60 次/小时提升到 5000 次/小时。
` : `
why-no-stars v${VERSION} — find out exactly why your repo isn't getting stars

Usage:
  wns <owner/repo> [options]

Options:
  --svg <file>     write a shareable SVG scorecard (- = stdout)
  --json <file>    write a machine-readable JSON report (- = stdout)
  --md <file>      write a Markdown report to paste into issues (- = stdout)
  --zh             output in Chinese
  --en             output in English
  --lang <lang>    override the detected primary language (for benchmarking)
  --token <token>  GitHub token (defaults to GITHUB_TOKEN / GH_TOKEN env)
  --no-benchmark   skip the ecosystem percentile (saves 7 API calls)
  --no-cache       skip the on-disk cache and run history (repo data cached 30 min)
  --fail-under <n> exit with code 10 when the score is below <n> (CI gate)
  --quiet          print a single summary line
  --color          force colored output
  --no-color       disable colored output
  --version        print version
  --help           print help

How to run:
  npx github:paopaonb666/why-no-stars <owner/repo>

Examples:
  wns sindresorhus/got
  wns me/my-project --svg scorecard.svg --zh
  wns https://github.com/expressjs/express --md report.md

Works without an API key. Set GITHUB_TOKEN to raise the limit from 60 to 5000 req/h.
`);

export class UsageError extends Error {}

// Major Node version from a version string ("22.5.1" -> 22); 0 when unparseable.
export function nodeMajor(ua = process.versions?.node) {
  const n = Number.parseInt(String(ua ?? '').split('.')[0], 10);
  return Number.isInteger(n) ? n : 0;
}

// Final exit code: hard failures (1) beat the CI gate (10), success is 0.
// Distinct code 10 lets scripts tell "your repo scored too low" from
// "the tool itself failed".
export function finalExitCode({ writeFailed = false, overall = null, failUnder = null } = {}) {
  if (writeFailed) return 1;
  if (failUnder !== null && overall !== null && overall < failUnder) return 10;
  return 0;
}

export function parseArgs(argv) {
  const opts = {
    slug: null, svg: null, json: null, md: null, lang: null, token: null,
    noBenchmark: false, noCache: false, quiet: false, color: null, help: false,
    version: false, locale: null, failUnder: null,
  };
  const positional = [];
  const nextValue = (flag) => {
    const v = argv[++i];
    if (v === undefined || v.trim() === '' || v.startsWith('--')) {
      throw new UsageError(envLocale() === 'zh'
        ? `选项 ${flag} 需要一个非空值。`
        : `Option ${flag} requires a non-empty value.`);
    }
    return v;
  };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    // --flag=value inline syntax
    const eq = a.indexOf('=');
    const flag = a.startsWith('--') && eq > 2 ? a.slice(0, eq) : a;
    const inline = a.startsWith('--') && eq > 2 ? a.slice(eq + 1) : undefined;
    // `--md=` / `--md ""` would silently disable the output — reject loudly.
    if (inline !== undefined && inline.trim() === '') {
      throw new UsageError(envLocale() === 'zh'
        ? `选项 ${flag} 需要一个非空值。`
        : `Option ${flag} requires a non-empty value.`);
    }
    switch (flag) {
      case '--svg': opts.svg = inline ?? nextValue('--svg'); break;
      case '--json': opts.json = inline ?? nextValue('--json'); break;
      case '--md': opts.md = inline ?? nextValue('--md'); break;
      case '--lang': opts.lang = inline ?? nextValue('--lang'); break;
      case '--token': opts.token = inline ?? nextValue('--token'); break;
      case '--zh': opts.locale = 'zh'; break;
      case '--en': opts.locale = 'en'; break;
      case '--no-benchmark': opts.noBenchmark = true; break;
      case '--no-cache': opts.noCache = true; break;
      case '--fail-under': {
        const v = inline ?? nextValue('--fail-under');
        if (!/^\d+$/.test(v) || Number(v) > 100) {
          throw new UsageError(envLocale() === 'zh'
            ? `--fail-under 需要 0–100 的整数，收到 ${JSON.stringify(v)}。`
            : `--fail-under expects an integer 0–100, got ${JSON.stringify(v)}.`);
        }
        opts.failUnder = Number(v);
        break;
      }
      case '--quiet': case '-q': opts.quiet = true; break;
      case '--color': opts.color = 'always'; break;
      case '--no-color': opts.color = 'never'; break;
      case '--help': case '-h': opts.help = true; break;
      case '--version': case '-v': opts.version = true; break;
      default:
        if (a.startsWith('--')) {
          throw new UsageError(envLocale() === 'zh' ? `未知选项：${a}` : `Unknown option: ${a}`);
        }
        positional.push(a);
    }
    i++;
  }
  if (positional.length > 1) {
    throw new UsageError(envLocale() === 'zh' ? '只需要一个仓库参数。' : 'Expected exactly one repo argument.');
  }
  opts.slug = positional[0] ?? null;
  return opts;
}

export function parseSlug(raw) {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const m = s.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], name: m[2] };
}

function envLocale() {
  const lang = process.env.LANG ?? process.env.LC_ALL ?? '';
  return /zh/i.test(lang) ? 'zh' : 'en';
}

function detectLocale(opts) {
  return opts.locale ?? envLocale();
}

function writeFileSafe(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (err) {
    const zh0 = envLocale() === 'zh';
    console.error(`error: ${err.message}`);
    console.error(zh0 ? '运行 --help 查看用法。' : 'Run with --help for usage.');
    return 1;
  }

  if (opts.version) { console.log(`why-no-stars v${VERSION}`); return 0; }

  const locale = detectLocale(opts);
  const zh = locale === 'zh';

  if (opts.help) { console.log(HELP(locale)); return 0; }

  if (!opts.slug) {
    console.error(zh ? 'error: 缺少 <owner/repo> 参数。' : 'error: missing <owner/repo>.');
    console.error(zh ? '运行 --help 查看用法。' : 'Run with --help for usage.');
    return 1;
  }

  const slug = parseSlug(opts.slug);
  if (!slug) {
    console.error(
      zh
        ? `无效仓库：${opts.slug}——需要 owner/repo 或 GitHub 链接。`
        : `Invalid repo: ${opts.slug} — expected owner/repo or a GitHub URL.`
    );
    return 1;
  }

  if (opts.color) setColorMode(opts.color);

  const cacheDir = opts.noCache ? null : resolveCacheDir();
  const repoCacheFile = `repo-${slug.owner}--${slug.name}.json`;
  const scoreCacheFile = `score-${slug.owner}--${slug.name}.json`;

  // Conditional requests: past the TTL, revalidation (304) costs no quota.
  const client = new GitHubClient({ token: opts.token, etagStore: cacheDir ? createEtagStore(cacheDir) : null });
  const say = (msg) => { if (!opts.quiet) console.error(dim(msg)); };

  // Friendly exits for known collection failures; null = not ours to handle.
  const collectErrorExit = (err) => {
    if (err instanceof RateLimitError) {
      console.error(
        zh
          ? `GitHub API 限流了。${err.message}\n设置 GITHUB_TOKEN 环境变量可提升到 5000 次/小时：https://github.com/settings/tokens`
          : `GitHub API rate limited. ${err.message}\nSet GITHUB_TOKEN to raise the limit: https://github.com/settings/tokens`
      );
      return 2;
    }
    if (err instanceof AuthError) {
      console.error(
        zh
          ? `GitHub 拒绝了你的 token（401）。检查 --token 参数或 GITHUB_TOKEN 环境变量是否有效、未过期。`
          : `GitHub rejected the token (401). Check that --token / GITHUB_TOKEN is valid and not expired.`
      );
      return 1;
    }
    if (err instanceof NotFoundError) {
      console.error(
        zh
          ? `找不到仓库 ${slug.owner}/${slug.name}：不存在、已改名，或是私有仓库（私有仓库需要提供 token）。`
          : `Repo ${slug.owner}/${slug.name} not found: it may not exist, be renamed, or be private (private repos need a token).`
      );
      return 1;
    }
    if (err instanceof NetworkError) {
      console.error(
        zh
          ? `网络请求失败：${err.message}\n请检查网络连接后重试（公司代理或防火墙可能拦截 api.github.com）。`
          : `Network request failed: ${err.message}\nCheck your connection and retry (a corporate proxy or firewall may block api.github.com).`
      );
      return 1;
    }
    if (err instanceof ApiError) {
      console.error(zh ? `GitHub API 出错：${err.message}` : `GitHub API error: ${err.message}`);
      return 1;
    }
    return null;
  };

  // Cache-first collection: repeat audits are fast, kind to the rate limit,
  // and comparable against the previous run. A rate-limited fresh fetch falls
  // back to stale cache (clearly flagged in the report) instead of dead-ending.
  let entry = cacheDir ? readEntry(cacheDir, repoCacheFile, { maxAgeMs: REPO_TTL_MS }) : null;
  let stale = false;
  if (entry) {
    say(zh
      ? `· 使用 ${fmtAge(Date.now() - entry.at, locale)}前缓存的仓库数据——加 --no-cache 强制重新采集。`
      : `· using cached repo data (fetched ${fmtAge(Date.now() - entry.at, locale)} ago) — pass --no-cache to force fresh.`);
  } else {
    try {
      say(zh ? `→ 正在采集仓库数据：${slug.owner}/${slug.name} …` : `→ collecting repo data: ${slug.owner}/${slug.name} …`);
      const payloads = await fetchPayloads(client, slug.owner, slug.name, { langOverride: opts.lang });
      // Cache payloads lang-free: --lang is a per-run lens, not repo truth.
      if (cacheDir) writeData(cacheDir, repoCacheFile, { ...payloads, langOverride: null });
      entry = { at: Date.now(), data: payloads };
      if (client.conditionalHits > 0) {
        say(zh
          ? `· ${client.conditionalHits} 个请求经 ETag 校验复用（304，不扣配额）。`
          : `· ${client.conditionalHits} requests revalidated via ETag (304, no quota cost).`);
      }
    } catch (err) {
      const older = cacheDir ? readEntry(cacheDir, repoCacheFile) : null; // any age
      if (err instanceof RateLimitError && older) {
        stale = true;
        console.error(dim(zh
          ? `· 已限流——改用 ${fmtAge(Date.now() - older.at, locale)}前的缓存数据生成报告（非实时）。`
          : `· rate limited — rendering cached data from ${fmtAge(Date.now() - older.at, locale)} ago (not live).`));
        entry = older;
      } else {
        const code = collectErrorExit(err);
        if (code === null) throw err;
        return code;
      }
    }
  }
  // langOverride comes from THIS run's flag, never from cached payloads.
  const facts = buildFacts({ ...entry.data, langOverride: opts.lang ?? null }, { now: new Date() });

  say(zh ? '→ 正在体检并评分 …' : '→ running checks and scoring …');
  const checks = runChecks(facts);
  const scorecard = scoreChecks(checks, { isArchived: facts.isArchived });

  // Run-over-run delta: read the previous scorecard before recording this one.
  const previous = cacheDir ? readEntry(cacheDir, scoreCacheFile) : null;
  const delta = previous && Number.isInteger(previous.data?.overall)
    ? { previousOverall: previous.data.overall, previousGrade: previous.data.grade, previousAt: previous.at }
    : null;

  // Heads-up before the benchmark burns calls the user may not have.
  if (!opts.noBenchmark && client.lastRemaining !== null && client.lastRemaining < 10) {
    say(zh
      ? `· API 剩余额度仅 ${client.lastRemaining} 次——生态对比可能被跳过。配置 GITHUB_TOKEN 可获得 5000 次/小时。`
      : `· Only ${client.lastRemaining} API calls left — the benchmark may be skipped. Set GITHUB_TOKEN for 5000/h.`);
  }

  let benchmark = null;
  if (!opts.noBenchmark) {
    const searchFile = `search-${encodeURIComponent(facts.language ?? 'all')}.json`;
    const cachedSearch = cacheDir ? readEntry(cacheDir, searchFile, { maxAgeMs: SEARCH_TTL_MS }) : null;
    if (Array.isArray(cachedSearch?.data?.counts)) {
      benchmark = percentileFromCounts(cachedSearch.data.counts, { stars: facts.stars, language: facts.language });
      say(zh
        ? `· 生态分布来自 ${fmtAge(Date.now() - cachedSearch.at, locale)}前的缓存。`
        : `· ecosystem counts from cache (${fmtAge(Date.now() - cachedSearch.at, locale)} old).`);
    } else {
      say(zh ? '→ 正在统计同类生态分布（7 次 API 调用）…' : '→ benchmarking against the language ecosystem (7 API calls) …');
      benchmark = await starPercentile(client, { stars: facts.stars, language: facts.language });
      if (benchmark && cacheDir) writeData(cacheDir, searchFile, { counts: benchmark.counts });
    }
    if (!benchmark) {
      console.error(
        dim(zh
          ? '· 生态分位已跳过（搜索接口限流）——配置 GITHUB_TOKEN 后可得生态对比。'
          : '· benchmark skipped (search API rate-limited) — set GITHUB_TOKEN to get the ecosystem percentile.')
      );
    }
  }

  if (opts.quiet) {
    const peers = benchmark
      ? (zh
        ? ` · ${fmtTopZh(benchmark)}（${facts.language ?? 'GitHub'} 同类）`
        : ` · ${fmtTopEn(benchmark)} of ${facts.language ?? 'GitHub'} peers`)
      : '';
    let deltaNote = '';
    if (delta) {
      const d = scorecard.overall - delta.previousOverall;
      deltaNote = zh
        ? (d === 0 ? '（与上次运行持平）' : `（较上次运行 ${d > 0 ? '▲+' : '▼'}${d}）`)
        : ` (${d === 0 ? 'Δ0' : d > 0 ? `▲+${d}` : `▼${d}`} vs last run)`;
    }
    console.log(`${facts.fullName}: ${scorecard.overall}/100 [${scorecard.grade}]${peers}${deltaNote}`);
  } else {
    console.log(renderTerminal({ facts, scorecard, benchmark, locale, delta, stale }));
    console.error(
      dim(zh
        ? `\n改完最值得做的几项，再跑一次——方法就这么多。`
        : `\nFix the top items, then run it again. That's the whole method.`)
    );
  }

  // Record this run for the next delta (best-effort; --no-cache skips it).
  if (cacheDir) writeData(cacheDir, scoreCacheFile, { overall: scorecard.overall, grade: scorecard.grade });

  // Per-file emit: a bad path in --md must not swallow the --svg output,
  // and a write failure must exit non-zero instead of dumping a stack.
  // "-" as the filename prints to stdout instead (pipe-friendly).
  let writeFailed = false;
  const emit = (file, content) => {
    if (file === '-') {
      console.log(content);
      return;
    }
    try {
      writeFileSafe(file, content);
    } catch (err) {
      writeFailed = true;
      console.error(
        zh ? `无法写入输出文件 ${file}：${err.message}` : `Failed to write output file ${file}: ${err.message}`
      );
    }
  };

  if (opts.svg) emit(opts.svg, renderSvg({ facts, scorecard, benchmark, locale, stale }));
  if (opts.md) emit(opts.md, renderMarkdown({ facts, scorecard, benchmark, locale, stale }));
  if (opts.json) {
    emit(opts.json, JSON.stringify(buildJsonReport({
      facts, scorecard, benchmark, checks, version: VERSION, delta, stale, locale,
    }), null, 2));
  }

  return finalExitCode({ writeFailed, overall: scorecard.overall, failUnder: opts.failUnder });
}
