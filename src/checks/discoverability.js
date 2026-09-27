// Pillar 5: Discoverability — can someone searching for this find it?
import { check } from './helpers.js';
import { normalizeName } from '../collect.js';

export function discoverabilityChecks(f) {
  const out = [];
  const readme = f.readme;

  out.push(
    check('not-fork-not-archived', 'discoverability', { en: 'Not a fork / not archived', zh: '非 fork / 未归档' }, {
      status: f.isFork || f.isArchived ? 'fail' : 'pass',
      detail: f.isFork
        ? { en: 'This is a fork — forks are excluded from GitHub search.', zh: '这是一个 fork——fork 不参与 GitHub 站内搜索。' }
        : f.isArchived
          ? { en: 'This repo is archived.', zh: '该仓库已归档。' }
          : { en: 'Original, active repo.', zh: '原创且活跃的仓库。' },
      fix: {
        en: f.isFork
          ? 'Forks cannot be found via GitHub search. Publish your work under your own repo name.'
          : 'If you intend to stop maintaining, say so in the README instead of archiving silently.',
        zh: f.isFork
          ? 'fork 不会被 GitHub 搜索收录。把你的成果用自己的仓库名重新发布。'
          : '如果打算停止维护，在 README 里说明，而不是默默归档。',
      },
      impact: 'high',
    })
  );

  const lines = readme?.lineCount ?? 0;
  out.push(
    check('readme-depth', 'discoverability', { en: 'README depth (50–1200 lines)', zh: 'README 篇幅（50–1200 行）' }, {
      status: readme === null ? 'skip' : lines >= 50 && lines <= 1200 ? 'pass' : lines >= 15 && lines <= 2500 ? 'warn' : 'fail',
      detail: readme
        ? { en: `${lines} lines`, zh: `${lines} 行` }
        : { en: 'No README — covered by the README check.', zh: '没有 README——已由「README 存在」检查覆盖。' },
      fix: {
        en: lines < 50
          ? 'Too thin: add installation, quickstart, examples, FAQ, and a comparison table.'
          : 'Too long: move details into docs/ and keep the README to one screen of decision-making info.',
        zh: lines < 50
          ? '太薄了：补安装、快速上手、示例、FAQ 和对比表。'
          : '太长了：把细节挪进 docs/，README 保留一屏内能读完的决策信息。',
      },
      impact: 'medium',
    })
  );

  const nameNorm = normalizeName(f.name ?? '');
  const firstHeading = readme?.headings?.find((h) => h.level <= 2);
  out.push(
    check('title-match', 'discoverability', { en: 'README title matches repo name', zh: 'README 标题与仓库名一致' }, {
      status: firstHeading ? (normalizeName(firstHeading.text).includes(nameNorm) ? 'pass' : 'warn') : 'warn',
      detail: firstHeading
        ? { en: `H${firstHeading.level}: “${firstHeading.text}”`, zh: `H${firstHeading.level}：「${firstHeading.text}」` }
        : { en: 'No top-level heading in README.', zh: 'README 顶层没有标题。' },
      fix: {
        en: 'Start the README with “# <repo-name> — one-line pitch”. Exact-name headings win browser tabs, search, and screenshots.',
        zh: 'README 第一行用「# <仓库名> — 一句话简介」。同名标题在浏览器标签页、搜索和截图里都占便宜。',
      },
      impact: 'low',
    })
  );

  const langCount = Object.keys(f.languages ?? {}).length;
  out.push(
    check('language-focus', 'discoverability', { en: 'Clear primary language', zh: '主语言清晰' }, {
      status: f.language ? 'pass' : 'warn',
      detail: f.language
        ? { en: `${f.language}${langCount > 1 ? ` (+${langCount - 1} other(s))` : ''}`, zh: `${f.language}${langCount > 1 ? `（另有 ${langCount - 1} 种语言）` : ''}` }
        : { en: 'GitHub could not detect a primary language.', zh: 'GitHub 未能识别主语言。' },
      fix: {
        en: 'A detected primary language puts you in language topic pages and enables peer benchmarking.',
        zh: '被识别出主语言才能进入语言 topic 页，也才能做同类对比。',
      },
      impact: 'medium',
    })
  );

  return out;
}
