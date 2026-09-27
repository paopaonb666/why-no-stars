// Pillar 4: Community health — roads for the first outsider to arrive.
import { check } from './helpers.js';

export function communityChecks(f) {
  const out = [];
  // Null means the community-profile fetch was refused — we know nothing about
  // these files, and claiming "missing" would fabricate evidence.
  const noData = (f.community ?? null) === null;
  const files = f.community?.files ?? {};
  // The profile returns file objects ({key, name, html_url}); fixtures and
  // older payloads may carry plain strings. Normalize once for the details.
  const nm = (v) => (typeof v === 'string' ? v : v?.name ?? v?.html_url) ?? null;
  const UNAVAILABLE = {
    en: 'Community profile unavailable (API refused) — not counted against you.',
    zh: '社区资料接口不可用（API 拒绝）——不计入评分。',
  };
  const UNVERIFIED = {
    en: 'Contents probe failed — cannot confirm presence or absence; not counted against you.',
    zh: '内容探测失败——无法确认有无，不计入评分。',
  };

  const templateUnknown = (noData && !f.issueTemplateKnown) || f.issueTemplateProbeState === 'unknown';
  const tplFile = nm(files.issue_template);
  out.push(
    check('issue-template', 'community', { en: 'Issue template', zh: 'Issue 模板' }, {
      status: templateUnknown ? 'skip' : tplFile || f.issueTemplateKnown ? 'pass' : 'warn',
      detail: templateUnknown
        ? (noData ? UNAVAILABLE : UNVERIFIED)
        : tplFile
          ? { en: `Found: ${tplFile}`, zh: `找到：${tplFile}` }
          : f.issueTemplateKnown
            ? { en: 'Found in .github/ISSUE_TEMPLATE (not surfaced by the community profile).', zh: '在 .github/ISSUE_TEMPLATE 中找到（community profile 未收录）。' }
            : { en: 'No issue template.', zh: '没有 issue 模板。' },
      fix: {
        en: 'Add .github/ISSUE_TEMPLATE with bug + feature forms. Triage cost drops, signal rises.',
        zh: '加 .github/ISSUE_TEMPLATE（bug + feature 表单）。筛选成本下降，有效信号上升。',
      },
      impact: 'medium',
    })
  );

  const prFile = nm(files.pull_request_template);
  out.push(
    check('pr-template', 'community', { en: 'PR template', zh: 'PR 模板' }, {
      status: noData ? 'skip' : prFile ? 'pass' : 'warn',
      detail: noData
        ? UNAVAILABLE
        : prFile
          ? { en: `Found: ${prFile}`, zh: `找到：${prFile}` }
          : { en: 'No PR template.', zh: '没有 PR 模板。' },
      fix: { en: 'Add a short PULL_REQUEST_TEMPLATE.md (what/why/how tested).', zh: '加一个简短的 PULL_REQUEST_TEMPLATE.md（改了什么/为什么/怎么测）。' },
      impact: 'low',
    })
  );

  const contributingFile = nm(files.contributing);
  out.push(
    check('contributing', 'community', { en: 'CONTRIBUTING guide', zh: 'CONTRIBUTING 指南' }, {
      status: noData ? 'skip' : contributingFile ? 'pass' : 'warn',
      detail: noData
        ? UNAVAILABLE
        : contributingFile
          ? { en: `Found: ${contributingFile}`, zh: `找到：${contributingFile}` }
          : { en: 'No CONTRIBUTING.md.', zh: '没有 CONTRIBUTING.md。' },
      fix: {
        en: 'Add CONTRIBUTING.md: how to set up dev env, run tests, and open a PR. Lower the barrier and outsiders appear.',
        zh: '加 CONTRIBUTING.md：怎么搭环境、跑测试、提 PR。门槛降低，外部贡献者才会出现。',
      },
      impact: 'medium',
    })
  );

  out.push(
    check('discussions', 'community', { en: 'Discussions enabled', zh: '开启 Discussions' }, {
      status: f.repo?.has_discussions ? 'pass' : 'warn',
      detail: f.repo?.has_discussions
        ? { en: 'Discussions are on.', zh: '已开启。' }
        : { en: 'Discussions are off.', zh: '未开启。' },
      fix: {
        en: 'Enable Discussions and add an ideas/pinned welcome post. It gives shy users a place to land.',
        zh: '开启 Discussions，发一个置顶欢迎帖。给不好意思开 issue 的用户一个落点。',
      },
      impact: 'low',
    })
  );

  const cocFile = nm(files.code_of_conduct);
  out.push(
    check('coc', 'community', { en: 'Code of conduct', zh: '行为准则' }, {
      status: noData ? 'skip' : cocFile ? 'pass' : 'warn',
      detail: noData
        ? UNAVAILABLE
        : cocFile
          ? { en: `Found: ${cocFile}`, zh: `找到：${cocFile}` }
          : { en: 'No code of conduct.', zh: '没有行为准则文件。' },
      fix: { en: 'Add a CODE_OF_CONDUCT.md (GitHub provides a template in one click).', zh: '加一个 CODE_OF_CONDUCT.md（GitHub 后台一键模板）。' },
      impact: 'low',
    })
  );

  const securityUnknown = (noData && !f.securityPolicyKnown) || f.securityProbeState === 'unknown';
  const secFile = nm(files.security_policy);
  out.push(
    check('security-policy', 'community', { en: 'Security policy', zh: '安全披露政策' }, {
      status: securityUnknown ? 'skip' : secFile || f.securityPolicyKnown ? 'pass' : 'warn',
      detail: securityUnknown
        ? (noData ? UNAVAILABLE : UNVERIFIED)
        : secFile
          ? { en: `Found: ${secFile}`, zh: `找到：${secFile}` }
          : f.securityPolicyKnown
            ? { en: 'Found SECURITY.md (not surfaced by the community profile).', zh: '找到 SECURITY.md（community profile 未收录）。' }
            : { en: 'No SECURITY.md — the Security tab shows “no policy”.', zh: '没有 SECURITY.md——Security 页会显示「未提供安全策略」。' },
      fix: {
        en: 'Add SECURITY.md describing how to report vulnerabilities privately (GitHub: Settings → Security → private vulnerability reporting).',
        zh: '加 SECURITY.md，说明如何私密上报漏洞（GitHub 后台：Settings → Security → 开启私密漏洞报告）。',
      },
      impact: 'low',
    })
  );

  return out;
}
