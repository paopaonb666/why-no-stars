// CLI entry: argument parsing, orchestration, friendly errors, exit codes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { GitHubClient, RateLimitError, AuthError, NotFoundError } from './api.js';
import { collectFacts } from './collect.js';
import { runChecks } from './checks/index.js';
import { scoreChecks } from './score.js';
import { starPercentile } from './benchmark.js';
import { renderTerminal, T, fmtTopEn, fmtTopZh } from './render/terminal.js';
import { renderSvg } from './render/svg.js';
import { renderMarkdown } from './render/markdown.js';
import { setColorMode, dim } from './ansi.js';

const VERSION = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
).version;

const HELP = (locale) => (locale === 'zh' ? `
why-no-stars v${VERSION} — 诊断你的 GitHub 仓库为什么没人 star

用法:
  wns <owner/repo> [选项]

选项:
  --svg <file>     输出可分享的 SVG 评分卡
  --json <file>    输出机器可读的完整 JSON 报告
  --md <file>      输出 Markdown 报告（可直接贴到 issue/discussion）
  --zh             用中文输出（默认自动检测）
  --en             用英文输出
  --lang <lang>    覆盖自动识别的主语言（用于生态分位对比）
  --token <token>  GitHub token（默认读 GITHUB_TOKEN / GH_TOKEN 环境变量）
  --no-benchmark   跳过生态分位对比（省 6 次 API 调用）
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
  --svg <file>     write a shareable SVG scorecard
  --json <file>    write a machine-readable JSON report
  --md <file>      write a Markdown report (paste into issues/discussions)
  --zh             output in Chinese
  --en             output in English
  --lang <lang>    override the detected primary language (for benchmarking)
  --token <token>  GitHub token (defaults to GITHUB_TOKEN / GH_TOKEN env)
  --no-benchmark   skip the ecosystem percentile (saves 7 API calls)
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

export function parseArgs(argv) {
  const opts = {
    slug: null, svg: null, json: null, md: null, lang: null, token: null,
    noBenchmark: false, quiet: false, color: null, help: false, version: false,
    locale: null,
  };
  const positional = [];
  const nextValue = (flag) => {
    const v = argv[++i];
    if (v === undefined || v.startsWith('--')) {
      throw new UsageError(`Option ${flag} requires a value.`);
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
    switch (flag) {
      case '--svg': opts.svg = inline ?? nextValue('--svg'); break;
      case '--json': opts.json = inline ?? nextValue('--json'); break;
      case '--md': opts.md = inline ?? nextValue('--md'); break;
      case '--lang': opts.lang = inline ?? nextValue('--lang'); break;
      case '--token': opts.token = inline ?? nextValue('--token'); break;
      case '--zh': opts.locale = 'zh'; break;
      case '--en': opts.locale = 'en'; break;
      case '--no-benchmark': opts.noBenchmark = true; break;
      case '--quiet': case '-q': opts.quiet = true; break;
      case '--color': opts.color = 'always'; break;
      case '--no-color': opts.color = 'never'; break;
      case '--help': case '-h': opts.help = true; break;
      case '--version': case '-v': opts.version = true; break;
      default:
        if (a.startsWith('--')) throw new UsageError(`Unknown option: ${a}`);
        positional.push(a);
    }
    i++;
  }
  if (positional.length > 1) throw new UsageError('Expected exactly one repo argument.');
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

function detectLocale(opts) {
  if (opts.locale) return opts.locale;
  const lang = process.env.LANG ?? process.env.LC_ALL ?? '';
  return /zh/i.test(lang) ? 'zh' : 'en';
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
    console.error(`error: ${err.message}`);
    console.error("Run with --help for usage.");
    return 1;
  }

  if (opts.version) { console.log(`why-no-stars v${VERSION}`); return 0; }

  const locale = detectLocale(opts);
  const zh = locale === 'zh';

  if (opts.help) { console.log(HELP(locale)); return 0; }

  if (!opts.slug) {
    console.error(zh ? 'error: 缺少 <owner/repo> 参数。' : 'error: missing <owner/repo>.');
    console.error("Run with --help for usage.");
    return 1;
  }

  const slug = parseSlug(opts.slug);
  if (!slug) {
    console.error(`Invalid repo: ${opts.slug} — expected owner/repo or a GitHub URL.`);
    return 1;
  }

  if (opts.color) setColorMode(opts.color);

  const client = new GitHubClient({ token: opts.token });
  const say = (msg) => { if (!opts.quiet) console.error(dim(msg)); };

  let facts;
  try {
    say(zh ? `→ 正在采集仓库数据：${slug.owner}/${slug.name} …` : `→ collecting repo data: ${slug.owner}/${slug.name} …`);
    facts = await collectFacts(client, slug.owner, slug.name, { langOverride: opts.lang });
  } catch (err) {
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
    throw err;
  }

  say(zh ? '→ 正在体检并评分 …' : '→ running checks and scoring …');
  const checks = runChecks(facts);
  const scorecard = scoreChecks(checks, { isArchived: facts.isArchived });

  let benchmark = null;
  if (!opts.noBenchmark) {
    say(zh ? '→ 正在统计同类生态分布（7 次 API 调用）…' : '→ benchmarking against the language ecosystem (7 API calls) …');
    benchmark = await starPercentile(client, { stars: facts.stars, language: facts.language });
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
        ? ` · ${fmtTopZh(benchmark)}`
        : ` · ${fmtTopEn(benchmark)} of ${facts.language ?? 'GitHub'} peers`)
      : '';
    console.log(`${facts.fullName}: ${scorecard.overall}/100 [${scorecard.grade}]${peers}`);
  } else {
    console.log(renderTerminal({ facts, scorecard, benchmark, locale }));
    console.error(
      dim(zh
        ? `\n改完最值得做的几项，再跑一次——方法就这么多。`
        : `\nFix the top items, then run it again. That's the whole method.`)
    );
  }

  if (opts.svg) writeFileSafe(opts.svg, renderSvg({ facts, scorecard, benchmark, locale }));
  if (opts.md) writeFileSafe(opts.md, renderMarkdown({ facts, scorecard, benchmark, locale }));
  if (opts.json) {
    writeFileSafe(opts.json, JSON.stringify({
      repo: {
        fullName: facts.fullName, stars: facts.stars, language: facts.language,
        description: facts.description, topics: facts.topics, pushedAt: facts.pushedAt,
      },
      overall: scorecard.overall,
      grade: scorecard.grade,
      benchmark: benchmark && {
        lowerPct: Number(benchmark.lowerPct.toFixed(2)),
        upperPct: Number(benchmark.upperPct.toFixed(2)),
        buckets: benchmark.counts,
        peerLanguage: facts.language,
        totalPeers: benchmark.total,
      },
      pillars: scorecard.pillars.map((p) => ({ id: p.id, name: T(p.name, locale), score: p.score, weight: p.weight })),
      checks: checks.map((c) => ({
        id: c.id, pillar: c.pillar, title: T(c.title, locale), status: c.status,
        impact: c.impact, detail: T(c.detail, locale), fix: T(c.fix, locale),
      })),
      generatedAt: new Date().toISOString(),
      tool: `why-no-stars v${VERSION}`,
    }, null, 2));
  }

  return 0;
}
