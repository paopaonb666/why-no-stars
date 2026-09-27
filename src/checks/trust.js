// Pillar 3: Trust & maintenance — signals that this repo is safe to adopt.
import { check } from './helpers.js';

function daysBetween(a, b) {
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function trustChecks(f) {
  const out = [];
  const now = f.now;

  const licenseName = f.community?.files?.license?.name ?? f.repo?.license?.name ?? null;
  out.push(
    check('license', 'trust', { en: 'License', zh: '开源协议' }, {
      status: licenseName && licenseName !== 'Other' ? 'pass' : 'fail',
      detail: licenseName
        ? { en: licenseName, zh: licenseName }
        : { en: 'No detectable license.', zh: '没有可识别的开源协议。' },
      fix: {
        en: 'Add a LICENSE (MIT/Apache-2.0). No license = legally unusable = nobody stars or adopts it.',
        zh: '加 LICENSE 文件（MIT/Apache-2.0）。没有协议 = 法律上不可用 = 没人会采用或收藏。',
      },
      impact: 'high',
    })
  );

  const testDir = f.rootFiles.some((x) => /^(tests?|spec|__tests__|e2e)$/i.test(x.name) && x.type === 'dir');
  const testWorkflow = (f.workflows?.workflows ?? []).some((w) => /test|ci|check/i.test(w.name ?? w.path ?? ''));
  const pkgTest = Boolean(f.packageJson?.scripts?.test);
  out.push(
    check('tests', 'trust', { en: 'Tests detected', zh: '检测到测试' }, {
      status: testDir || pkgTest || testWorkflow ? 'pass' : 'fail',
      detail: testDir
        ? { en: 'Found a test directory at the root.', zh: '根目录找到了测试目录。' }
        : pkgTest
          ? { en: 'package.json has a test script.', zh: 'package.json 定义了 test 脚本。' }
          : testWorkflow
            ? { en: 'A CI workflow appears to run tests.', zh: '某个 CI workflow 似乎会跑测试。' }
            : { en: 'No test directory, test script, or test workflow found.', zh: '没有找到测试目录、测试脚本或测试 workflow。' },
      fix: {
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
        : { en: 'No GitHub Actions workflows found.', zh: '没有找到 GitHub Actions workflow。' },
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
      fix: {
        en: days > 180
          ? 'The repo looks abandoned. Push an update, or add a note about maintenance status at the top of the README.'
          : 'Keep a heartbeat: even small merged PRs keep the repo looking alive.',
        zh: days > 180
          ? '仓库看起来像弃坑了。推一个更新，或在 README 顶部说明维护状态。'
          : '保持心跳：即使合并小 PR 也能让仓库看起来还活着。',
      },
      impact: 'high',
    })
  );

  out.push(
    check('releases', 'trust', { en: 'Releases / tags', zh: 'Release / 标签' }, {
      status: f.releases.length >= 1 ? 'pass' : f.tags.length >= 1 ? 'warn' : 'fail',
      detail: f.releases.length
        ? { en: `${f.releases.length} release(s), latest “${f.releases[0].tag}”.`, zh: `${f.releases.length} 个 release，最新 ${f.releases[0].tag}。` }
        : f.tags.length
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
      status: f.contributors >= 2 ? 'pass' : f.contributors === 1 ? 'warn' : 'fail',
      detail: { en: `${f.contributors} contributor(s) visible.`, zh: `可见 ${f.contributors} 位贡献者。` },
      fix: {
        en: 'Invite contributions: label issues as “good first issue”, and list contributors in the README.',
        zh: '邀请贡献：给 issue 打「good first issue」标签，并在 README 里列出贡献者。',
      },
      impact: 'medium',
    })
  );

  const semverTags = f.tags.filter((t) => /^v?\d+\.\d+\.\d+/.test(t));
  out.push(
    check('semver', 'trust', { en: 'Semver tags', zh: '语义化版本标签' }, {
      status: f.tags.length === 0 ? 'skip' : semverTags.length / f.tags.length >= 0.6 ? 'pass' : 'warn',
      detail: f.tags.length
        ? { en: `${semverTags.length}/${f.tags.length} tags are semver-shaped.`, zh: `${semverTags.length}/${f.tags.length} 个 tag 符合语义化版本。` }
        : { en: 'No tags to evaluate.', zh: '没有可评估的 tag。' },
      fix: {
        en: 'Tag versions as v1.2.3. Semver communicates stability to humans and package managers.',
        zh: '用 v1.2.3 格式打版本 tag。语义化版本同时向人和包管理器传达稳定性。',
      },
      impact: 'low',
    })
  );

  return out;
}
