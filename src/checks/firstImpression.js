// Pillar 1: First impression — what a visitor judges in the first 10 seconds.
import { check } from './helpers.js';

export function firstImpressionChecks(f) {
  const out = [];

  const desc = f.description ?? '';
  out.push(
    check('description', 'first-impression', { en: 'Repo description', zh: '仓库描述' }, {
      status: !desc ? 'fail' : desc.length >= 15 && desc.length <= 130 ? 'pass' : 'warn',
      detail: desc
        ? { en: `“${desc}” (${desc.length} chars)`, zh: `「${desc}」（${desc.length} 字符）` }
        : { en: 'No description set.', zh: '未设置 description。' },
      fix: {
        en: 'Write a 15–130 char description: what it does + for whom + the differentiator.',
        zh: '写一句 15–130 字符的描述：做什么 + 给谁用 + 有什么不同。',
      },
      impact: 'high',
    })
  );

  const topics = f.topics ?? [];
  const topicsOver = topics.length > 20; // GitHub hard-caps repos at 20 topics
  out.push(
    check('topics', 'first-impression', { en: 'Topics (3+)', zh: 'Topics 标签（3 个以上）' }, {
      status: topicsOver ? 'warn' : topics.length >= 3 ? 'pass' : topics.length >= 1 ? 'warn' : 'fail',
      detail: topics.length === 0
        ? { en: 'No topics set.', zh: '没有设置任何 topic。' }
        : topicsOver
          ? { en: `${topics.length} topics — GitHub caps repos at 20, so the extra ones are dropped.`, zh: `有 ${topics.length} 个 topic——GitHub 上限是 20 个，多出的会被直接丢弃。` }
          : { en: topics.join(', '), zh: topics.join('、') },
      fix: topicsOver
        ? {
            en: 'Trim to the 5–8 topics that actually drive discovery (domain words + ecosystem words); the rest are silently discarded.',
            zh: '精简到 5–8 个真正带来曝光的 topic（领域词 + 生态词）；多出的会被 GitHub 静默丢弃。',
          }
        : {
            en: 'Add 3–8 topics mixing domain (cli, api) and ecosystem (nodejs, rust). They drive GitHub search & topic pages.',
            zh: '加 3–8 个 topic，混合领域词（cli、api）和生态词（nodejs、rust）。它们直接决定 GitHub 搜索和 topic 页的曝光。',
          },
      impact: 'high',
    })
  );

  out.push(
    check('homepage', 'first-impression', { en: 'Homepage URL', zh: '主页链接' }, {
      status: f.homepage ? 'pass' : 'warn',
      detail: f.homepage
        ? { en: f.homepage, zh: f.homepage }
        : { en: 'No homepage URL in the About sidebar.', zh: 'About 侧边栏没有设置主页链接。' },
      fix: {
        en: 'Set the repo homepage (docs site, demo, or README anchor) — it is the only clickable field in the About box.',
        zh: '在仓库 About 里设置主页链接（文档站 / demo / README 锚点）——这是 About 区唯一可点击的字段。',
      },
      impact: 'medium',
    })
  );

  if (!f.readme) {
    out.push(
      check('readme-exists', 'first-impression', { en: 'README exists', zh: 'README 存在' }, {
        status: 'fail',
        detail: { en: 'No README found.', zh: '没有找到 README。' },
        fix: { en: 'Add a README.md — without one, a repo is invisible.', zh: '补一个 README.md——没有 README 的仓库等于隐身。' },
        impact: 'high',
      })
    );
    return out;
  }

  // Translated READMEs (README.zh-CN.md, README.es.md, …) widen reach; a
  // detail-only enrichment — the score must not depend on which languages.
  const readmeVariants = f.rootFiles
    .map((x) => x.name)
    .filter((n) => /^readme(\.[a-z]{2,3}(-[a-z]{2,4})?)?\.(md|markdown|txt)$/i.test(n))
    .filter((n) => !/^readme\.(md|markdown|txt)$/i.test(n));
  out.push(
    check('readme-exists', 'first-impression', { en: 'README exists', zh: 'README 存在' }, {
      status: 'pass',
      detail: readmeVariants.length
        ? {
            en: `${f.readme.lineCount} lines · also available in: ${readmeVariants.join(', ')}`,
            zh: `${f.readme.lineCount} 行 · 另有语言版本：${readmeVariants.join('、')}`,
          }
        : { en: `${f.readme.lineCount} lines`, zh: `${f.readme.lineCount} 行` },
    })
  );

  // A badge is not a hero image: exclude badge-like URLs when picking the
  // first real visual (react's license badge sits inside its H1).
  const firstRealImage = (f.readme.images.filter((im) => !im.badge)[0])?.line ?? null;
  out.push(
    check('hero-visual', 'first-impression', { en: 'Hero image / GIF above the fold', zh: '首屏有截图 / GIF / Demo 图' }, {
      status: firstRealImage === null ? 'fail' : firstRealImage <= 60 ? 'pass' : firstRealImage <= 120 ? 'warn' : 'fail',
      detail: firstRealImage
        ? { en: `First non-badge image at line ${firstRealImage}`, zh: `第一张非徽章图片在第 ${firstRealImage} 行` }
        : f.readme.images.length
          ? { en: 'Only badge images found — no real screenshot/demo/hero.', zh: '只有徽章类图片——没有真正的截图 / demo / 主视觉。' }
          : { en: 'No image in the README at all.', zh: '整个 README 没有一张图片。' },
      fix: {
        en: 'Put a screenshot/GIF/demo within the first ~40 lines. Visitors decide in seconds; text alone rarely converts.',
        zh: '把截图 / GIF / demo 图放到 README 前 ~40 行。访客只给你几秒钟，纯文字几乎不会转化。',
      },
      impact: 'high',
    })
  );

  const installLine = f.readme.installLine;
  out.push(
    check('install-above-fold', 'first-impression', { en: 'Install command near the top', zh: '安装命令靠近顶部' }, {
      status: installLine === null ? 'fail' : installLine <= 60 ? 'pass' : installLine <= 150 ? 'warn' : 'fail',
      detail: installLine
        ? { en: `First installable command at line ${installLine}`, zh: `第一条可复制的安装命令在第 ${installLine} 行` }
        : { en: 'No recognizable install command in the README.', zh: 'README 中没有可识别的安装命令。' },
      fix: {
        en: 'Move the copy-paste install one-liner into the first screen of the README (top ~60 lines).',
        zh: '把可复制的安装命令提到 README 首屏（前 ~60 行）内。',
      },
      impact: 'high',
    })
  );

  const badges = f.readme.badges;
  out.push(
    check('badges', 'first-impression', { en: 'Badges (1–12)', zh: '徽章（1–12 个）' }, {
      status: badges >= 1 && badges <= 12 ? 'pass' : 'warn',
      detail: { en: `${badges} badge(s) near the top`, zh: `顶部附近有 ${badges} 个徽章` },
      fix: {
        en: badges === 0
          ? 'Add 3–5 badges (build, npm/pypi version, license). They signal “this is maintained”.'
          : 'Trim badge noise: keep build status, latest release, and license.',
        zh: badges === 0
          ? '加 3–5 个徽章（构建状态、npm/pypi 版本、license）。它们传达“这个项目还在维护”。'
          : '精简徽章：保留构建状态、最新版本和 license 即可。',
      },
      impact: 'low',
    })
  );

  const name = f.name ?? '';
  const nameOk = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,23}$/.test(name) &&
    !/^(test|demo|tmp|temp|new|my|untitled|foo|asdf)([-_.].+)?$/i.test(name);
  out.push(
    check('name-quality', 'first-impression', { en: 'Repo name quality', zh: '仓库名质量' }, {
      status: nameOk ? 'pass' : 'warn',
      detail: { en: `“${name}”`, zh: `「${name}」` },
      fix: {
        en: 'Pick a memorable, searchable name: 3–24 chars, hint at what it does, avoid test/demo/tmp prefixes.',
        zh: '取一个可记忆、可搜索的名字：3–24 字符，暗示功能，避免 test/demo/tmp 前缀。',
      },
      impact: 'medium',
    })
  );

  return out;
}
