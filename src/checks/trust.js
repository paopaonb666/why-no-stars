// Pillar 3: Trust & maintenance — signals that this repo is safe to adopt.
import { check } from './helpers.js';

function daysBetween(a, b) {
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function trustChecks(f) {
  const out = [];
  const now = f.now;

  // A fork inherits its parent's tags, releases and contributor list — scoring
  // them would praise work the fork never did.
  const inherited = f.isFork;

  const licenseFile = f.community?.files?.license ?? null;
  const spdx = f.repo?.license?.spdx_id ?? f.repo?.license?.name ?? null;
  out.push(
    check('license', 'trust', { en: 'License', zh: '开源协议' }, {
      status: !licenseFile ? 'fail' : spdx && spdx !== 'NOASSERTION' && spdx !== 'Other' ? 'pass' : 'warn',
      detail: !licenseFile
        ? { en: 'No detectable license.', zh: '没有可识别的开源协议。' }
        : spdx && spdx !== 'NOASSERTION' && spdx !== 'Other'
          ? { en: `${spdx} (license file present).`, zh: `${spdx}（已检测到协议文件）。` }
          : { en: 'License file present but not auto-identified (custom or variant license).', zh: '检测到协议文件，但无法自动识别具体协议（自定义或变体协议）。' },
      fix: !licenseFile
        ? {
            en: 'Add a LICENSE (MIT/Apache-2.0). No license = legally unusable = nobody stars or adopts it.',
            zh: '加 LICENSE 文件（MIT/Apache-2.0）。没有协议 = 法律上不可用 = 没人会采用或收藏。',
          }
        : {
            en: 'Name the license in the README (e.g. “Licensed under GPL-2.0”) so adopters don’t have to guess.',
            zh: '在 README 里写明协议（如「基于 GPL-2.0 授权」），让采用者不必猜。',
          },
      impact: 'high',
    })
  );

  const testDir = f.rootFiles.some((x) => /^(tests?|testing|spec|__tests__|e2e|selftest)$/i.test(x.name) && x.type === 'dir');
  const testConfig = f.rootFiles.some((x) =>
    /^(jest\.config\.(js|ts|mjs|cjs)|vitest\.config\.(js|ts|mjs)|pytest\.ini|tox\.ini|conftest\.py|karma\.conf\.js|setup\.cfg)$/i.test(x.name)
  );
  const testWorkflow = (f.workflows?.workflows ?? []).some((w) => /test|ci|check/i.test(w.name ?? w.path ?? ''));
  const pkgTest = Boolean(f.packageJson?.scripts?.test);
  const testsDetected = testDir || testConfig || testWorkflow || pkgTest;
  out.push(
    check('tests', 'trust', { en: 'Tests detected', zh: '检测到测试' }, {
      status: testsDetected ? 'pass' : f.hasManifest || testWorkflow ? 'fail' : 'warn',
      detail: testDir
        ? { en: 'Found a test directory at the root.', zh: '根目录找到了测试目录。' }
        : testConfig
          ? { en: 'Found a test runner config at the root.', zh: '根目录找到了测试框架配置。' }
          : pkgTest
            ? { en: 'package.json has a test script.', zh: 'package.json 定义了 test 脚本。' }
            : testWorkflow
              ? { en: 'A CI workflow appears to run tests.', zh: '某个 CI workflow 似乎会跑测试。' }
              : f.hasManifest
                ? { en: 'No test directory, config, test script, or test workflow found.', zh: '没有找到测试目录、测试配置、测试脚本或测试 workflow。' }
                : {
                    en: 'No root-level test signals. Projects without a package manifest (kernel, native code) often keep tests in subdirectories this check can’t see.',
                    zh: '根目录没有测试信号。无包清单的项目（内核、原生代码）常把测试放在更深的子目录，本检查看不到。',
                  },
      fix: testsDetected || !f.hasManifest
        ? {
            en: 'Make existing tests discoverable: a root-level tests/ dir or test-runner config, and a CI badge.',
            zh: '让已有测试可被发现：根级 tests/ 目录或测试框架配置，加上 CI 徽章。',
          }
        : {
            en: 'Add even a minimal test suite + make it visible (tests/ dir, test script, CI badge). Tests are the strongest trust signal.',
            zh: '哪怕加一个最小测试套件也要让它可见（tests/ 目录、test 脚本、CI 徽章）。测试是最强的信任信号。',
          },
      impact: 'high',
    })
  );

  const ciCount = f.workflows?.total_count ?? 0;
  out.push(
    check('ci', 'trust', { en: 'CI configured', zh: '配置了 CI' }, {
      status: ciCount >= 1 ? 'pass' : 'warn',
      detail: ciCount
        ? { en: `${ciCount} GitHub Actions workflow(s).`, zh: `有 ${ciCount} 个 GitHub Actions workflow。` }
        : { en: 'No GitHub Actions workflows found (CI may exist off-GitHub).', zh: '没有找到 GitHub Actions workflow（CI 也可能在 GitHub 之外）。' },
      fix: {
        en: 'Add a CI workflow (build + test) and show its badge at the top of the README.',
        zh: '加一个 CI workflow（构建 + 测试），并把徽章放到 README 顶部。',
      },
      impact: 'medium',
    })
  );

  const days = f.pushedAt ? daysBetween(new Date(f.pushedAt), now) : Infinity;
  out.push(
    check('recent-activity', 'trust', { en: 'Recent activity (90d)', zh: '近期有提交（90 天内）' }, {
      status: days <= 90 ? 'pass' : days <= 180 ? 'warn' : 'fail',
      detail: Number.isFinite(days)
        ? { en: `Last push ${days} day(s) ago.`, zh: `最后一次提交是 ${days} 天前。` }
        : { en: 'Unknown last-push time.', zh: '未知最后提交时间。' },
      fix: f.isArchived
        ? {
            en: 'This repo is archived and cannot be updated. Consider unarchiving, or point visitors to an active successor in the README.',
            zh: '仓库已归档、无法更新。考虑解除归档，或在 README 里指引用户前往活跃的继任项目。',
          }
        : days > 180
          ? {
              en: 'The repo looks abandoned. Push an update, or add a note about maintenance status at the top of the README.',
              zh: '仓库看起来像弃坑了。推一个更新，或在 README 顶部说明维护状态。',
            }
          : {
              en: 'Keep a heartbeat: even small merged PRs keep the repo looking alive.',
              zh: '保持心跳：即使合并小 PR 也能让仓库看起来还活着。',
            },
      impact: 'high',
    })
  );

  const releasesKnown = Array.isArray(f.releases);
  out.push(
    check('releases', 'trust', { en: 'Releases / tags', zh: 'Release / 标签' }, {
      status: inherited || !releasesKnown
        ? 'skip'
        : f.releases.length >= 1
          ? 'pass'
          : (f.tags?.length ?? 0) >= 1
            ? 'warn'
            : 'fail',
      detail: inherited
        ? { en: 'Fork: releases are inherited from the parent repo.', zh: 'Fork：release 继承自父仓库，不计入评分。' }
        : !releasesKnown
          ? { en: 'Release data unavailable (API refused) — not counted against you.', zh: 'release 数据不可用（API 拒绝）——不计入评分。' }
          : f.releases.length
            ? { en: `${f.releases.length} release(s), latest “${f.releases[0].tag}”.`, zh: `${f.releases.length} 个 release，最新 ${f.releases[0].tag}。` }
            : (f.tags?.length ?? 0)
              ? { en: `${f.tags.length} tag(s) but no published release.`, zh: `有 ${f.tags.length} 个 tag，但没有发布过 release。` }
              : { en: 'No tags and no releases.', zh: '没有 tag 也没有 release。' },
      fix: {
        en: 'Publish a GitHub Release with readable notes. Releases trigger watcher emails and look maintained.',
        zh: '发布一个带可读 changelog 的 GitHub Release。Release 会触发 watch 通知，也显得项目有维护。',
      },
      impact: 'medium',
    })
  );

  out.push(
    check('contributors', 'trust', { en: 'Contributors (2+)', zh: '贡献者（2 人以上）' }, {
      status: inherited || f.contributors === null
        ? 'skip'
        : f.contributors >= 2
          ? 'pass'
          : f.contributors === 1
            ? 'warn'
            : 'warn',
      detail: inherited
        ? { en: 'Fork: contributor count is inherited from the parent repo.', zh: 'Fork：贡献者继承自父仓库，不计入评分。' }
        : f.contributors === null
          ? { en: 'Contributor list unavailable via API (repository too large) — not counted against you.', zh: '贡献者列表因仓库过大无法通过 API 获取——不计入评分。' }
          : { en: `${f.contributors} contributor(s) visible.`, zh: `可见 ${f.contributors} 位贡献者。` },
      fix: {
        en: 'Invite contributions: label issues as “good first issue”, and list contributors in the README.',
        zh: '邀请贡献：给 issue 打「good first issue」标签，并在 README 里列出贡献者。',
      },
      impact: 'medium',
    })
  );

  const tagsKnown = Array.isArray(f.tags);
  const semverTags = tagsKnown ? f.tags.filter((t) => /^v?\d+\.\d+(\.\d+)?([-+].*)?$/.test(t)) : [];
  out.push(
    check('semver', 'trust', { en: 'Semver tags', zh: '语义化版本标签' }, {
      status: !tagsKnown || inherited || f.tags.length === 0
        ? 'skip'
        : semverTags.length / f.tags.length >= 0.6
          ? 'pass'
          : 'warn',
      detail: !tagsKnown || inherited
        ? { en: inherited ? 'Fork: tags are inherited from the parent repo.' : 'Tag data unavailable — not counted against you.', zh: inherited ? 'Fork：tag 继承自父仓库，不计入评分。' : 'tag 数据不可用——不计入评分。' }
        : f.tags.length === 0
          ? { en: 'No tags to evaluate.', zh: '没有可评估的 tag。' }
          : { en: `${semverTags.length}/${f.tags.length} tags are version-shaped (X.Y or X.Y.Z).`, zh: `${semverTags.length}/${f.tags.length} 个 tag 符合版本格式（X.Y 或 X.Y.Z）。` },
      fix: {
        en: 'Tag versions as v1.2 (or v1.2.3). Consistent version tags communicate stability to humans and package managers.',
        zh: '用 v1.2（或 v1.2.3）格式打版本 tag。一致的版本 tag 同时向人和包管理器传达稳定性。',
      },
      impact: 'low',
    })
  );

  return out;
}
