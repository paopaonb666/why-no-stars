// Pillar 4: Community health — roads for the first outsider to arrive.
import { check } from './helpers.js';

export function communityChecks(f) {
  const out = [];
  const files = f.community?.files ?? {};

  out.push(
    check('issue-template', 'community', { en: 'Issue template', zh: 'Issue 模板' }, {
      status: files.issue_template ? 'pass' : 'warn',
      detail: files.issue_template
        ? { en: `Found: ${files.issue_template}`, zh: `找到：${files.issue_template}` }
        : { en: 'No issue template.', zh: '没有 issue 模板。' },
      fix: {
        en: 'Add .github/ISSUE_TEMPLATE with bug + feature forms. Triage cost drops, signal rises.',
        zh: '加 .github/ISSUE_TEMPLATE（bug + feature 表单）。筛选成本下降，有效信号上升。',
      },
      impact: 'medium',
    })
  );

  out.push(
    check('pr-template', 'community', { en: 'PR template', zh: 'PR 模板' }, {
      status: files.pull_request_template ? 'pass' : 'warn',
      detail: files.pull_request_template
        ? { en: `Found: ${files.pull_request_template}`, zh: `找到：${files.pull_request_template}` }
        : { en: 'No PR template.', zh: '没有 PR 模板。' },
      fix: { en: 'Add a short PULL_REQUEST_TEMPLATE.md (what/why/how tested).', zh: '加一个简短的 PULL_REQUEST_TEMPLATE.md（改了什么/为什么/怎么测）。' },
      impact: 'low',
    })
  );

  out.push(
    check('contributing', 'community', { en: 'CONTRIBUTING guide', zh: 'CONTRIBUTING 指南' }, {
      status: files.contributing ? 'pass' : 'warn',
      detail: files.contributing
        ? { en: `Found: ${files.contributing}`, zh: `找到：${files.contributing}` }
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

  out.push(
    check('coc', 'community', { en: 'Code of conduct', zh: '行为准则' }, {
      status: files.code_of_conduct ? 'pass' : 'warn',
      detail: files.code_of_conduct
        ? { en: `Found: ${files.code_of_conduct}`, zh: `找到：${files.code_of_conduct}` }
        : { en: 'No code of conduct.', zh: '没有行为准则文件。' },
      fix: { en: 'Add a CODE_OF_CONDUCT.md (GitHub provides a template in one click).', zh: '加一个 CODE_OF_CONDUCT.md（GitHub 后台一键模板）。' },
      impact: 'low',
    })
  );

  out.push(
    check('security-policy', 'community', { en: 'Security policy', zh: '安全披露政策' }, {
      status: files.security_policy ? 'pass' : 'warn',
      detail: files.security_policy
        ? { en: `Found: ${files.security_policy}`, zh: `找到：${files.security_policy}` }
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
