// Data collection: turn GitHub API payloads into a single "facts" object.
// fetchPayloads  = network side (mockable / recordable for fixtures)
// buildFacts     = pure transform (unit-testable)

import { RateLimitError, NotFoundError } from './api.js';

// Case-insensitive on purpose: READMEs shout ("NPM INSTALL") and prose often
// mentions the command. Recognizes the install one-liners of the major
// ecosystems (npm/pnpm/yarn/bun/deno, pip/uv, cargo, go, brew, conda, gem,
// composer, dotnet, docker) plus the runner forms (npx/uvx/dlx/npm exec).
const INSTALL_RE =
  /(?:^|[\s`(])(npm (?:i|install|ci|exec)\b|npx \S+|pnpm (?:add|install|dlx)\b|yarn (?:add|install|dlx)\b|bun (?:add|install|dlx)\b|pip3? install\b|uv (?:pip install|add|tool install|run|sync)\b|uvx \S+|cargo (?:add|install|binstall)\b|go install\b|brew install\b|conda install\b|gem install\b|composer require\b|dotnet (?:add package|tool install)\b|docker (?:run|pull)\b|deno (?:add|install)\b)/i;

export function decodeBase64File(payload) {
  if (!payload || payload.encoding !== 'base64' || typeof payload.content !== 'string') return null;
  return Buffer.from(payload.content, 'base64').toString('utf8');
}

export function findInstallLine(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (INSTALL_RE.test(lines[i])) return i + 1; // 1-based line number
  }
  return null;
}

export function parseReadme(text) {
  // Strip HTML comments but preserve newlines, so line numbers stay true.
  // got's coverage badge hides in a comment — invisible to visitors, and
  // previously counted as a "hero image".
  const visible = text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = visible.split(/\r?\n/);
  const headings = [];
  const images = [];
  const codeBlocks = [];
  let inFence = false;
  let fenceStart = 0;
  let badges = 0;

  const isBadgeUrl = (url) =>
    /(badge|shields\.io|travis|circleci|codecov|coveralls|npmjs|pypi|crates\.io|goreportcard|deepwiki|packagephobia|badge\.fury)/i.test(url);

  lines.forEach((line, i) => {
    const n = i + 1;
    if (!inFence) {
      // Markdown ATX headings and HTML <h1>-<h6> both render as headings.
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) headings.push({ level: h[1].length, text: h[2].trim(), line: n });
      const hHtml = line.match(/<h([1-6])[^>]*>(.*?)<\/h\1>/i);
      if (hHtml) headings.push({ level: Number(hHtml[1]), text: hHtml[2].replace(/<[^>]*>/g, '').trim(), line: n });

      // Markdown images and HTML <img> tags both render as visuals.
      for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
        const url = m[1];
        const badge = isBadgeUrl(url);
        images.push({ url, line: n, badge });
        if (n <= 45 && badge) badges++;
      }
      for (const m of line.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
        const url = m[1];
        const badge = isBadgeUrl(url);
        images.push({ url, line: n, badge });
        if (n <= 45 && badge) badges++;
      }
    }
    if (/^(```|~~~)/.test(line.trim())) {
      if (!inFence) {
        inFence = true;
        fenceStart = n;
      } else {
        inFence = false;
        codeBlocks.push({ start: fenceStart, end: n });
      }
    }
  });

  // Setext headings (Title\n=====) — used by the Linux kernel README.
  if (!inFence) {
    for (let i = 0; i < lines.length - 1; i++) {
      const t = lines[i].trim();
      const u = lines[i + 1].trim();
      if (t && !headings.some((h) => h.line === i + 1)) {
        if (/^={2,}$/.test(u)) headings.push({ level: 1, text: t, line: i + 1 });
        else if (/^-{2,}$/.test(u) && !/^[-*+]?\s*\[[ x]\]/i.test(t) && !t.startsWith('|')) headings.push({ level: 2, text: t, line: i + 1 });
      }
    }
  }
  headings.sort((a, b) => a.line - b.line);

  const installLine = findInstallLine(lines);
  return {
    text,
    lineCount: lines.length,
    headings,
    images,
    codeBlocks,
    badges,
    installLine,
  };
}

export function normalizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Did the community profile / contents probe confirm the file exists?
// Handles the three fetchPayloads states ('known-present'/'known-absent'/
// 'unknown') plus legacy fixture shapes (array of names, filename, true).
const probeFound = (v) =>
  v === 'known-present' || Array.isArray(v) || v === true ||
  (typeof v === 'string' && v !== 'known-absent' && v !== 'unknown');

export function buildFacts(p, { now = new Date() } = {}) {
  const repo = p.repo;
  const readmeText = p.readme ? decodeBase64File(p.readme) : null;

  let packageJson = null;
  if (p.packageJson) {
    try {
      const raw = decodeBase64File(p.packageJson);
      packageJson = raw ? JSON.parse(raw) : null;
    } catch {
      packageJson = null;
    }
  }

  const rootFiles = Array.isArray(p.contents)
    ? p.contents.map((f) => ({ name: f.name, type: f.type }))
    : [];
  const contentsKnown = Array.isArray(p.contents);
  const workflowsKnown = p.workflows != null;
  const workflows = p.workflows ?? { total_count: 0, workflows: [] };

  // p.stargazers is the computed last page of the stargazers list:
  //   null            -> the request failed (e.g. GitHub caps deep pagination)
  //   []              -> the request succeeded but the page is empty
  //   [ ...entries ]  -> the newest (stars - 100*(lastPage-1)) stars
  const stargazerTimestamps = Array.isArray(p.stargazers)
    ? p.stargazers.map((s) => s.starred_at).filter(Boolean).sort()
    : [];
  // 'full': every star timestamp known (repo <= 100 stars, page 1 = all stars)
  // 'lastpage': the newest stars from the computed last page (any length)
  // 'none': timestamps unavailable -> momentum falls back to the events feed
  let starSample = 'none';
  if (stargazerTimestamps.length >= 1) {
    starSample = repo.stargazers_count <= 100 ? 'full' : 'lastpage';
  }

  const DAY = 86400000;
  const recentStarEvents28 = Array.isArray(p.events)
    ? (p.events ?? []).filter(
        (e) => e?.type === 'WatchEvent' && e?.created_at && now - new Date(e.created_at) <= 28 * DAY
      ).length
    : 0;

  const manifestNames = [
    'package.json', 'pyproject.toml', 'setup.py', 'setup.cfg', 'Cargo.toml', 'go.mod',
    'pom.xml', 'build.gradle', 'build.gradle.kts', 'Gemfile', 'composer.json', 'mix.exs',
    'pubspec.yaml', 'renv.lock', 'DESCRIPTION',
  ];

  return {
    repo,
    owner: repo.owner?.login ?? '',
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description ?? null,
    topics: repo.topics ?? [],
    homepage: repo.homepage ?? null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    watchers: repo.subscribers_count ?? 0,
    openIssues: repo.open_issues_count ?? 0,
    isFork: Boolean(repo.fork),
    isArchived: Boolean(repo.archived),
    pushedAt: repo.pushed_at ?? null,
    createdAt: repo.created_at ?? null,
    language: p.langOverride || repo.language || null,
    languages: p.languages ?? {},

    rootFiles,
    contentsKnown,
    hasManifest: rootFiles.some((f) => manifestNames.includes(f.name)),
    packageJson,
    workflows,
    workflowsKnown,
    // These three may be null when the API refused (e.g. contributor lists of
    // very large repos 403). Null means "unknown", never "zero".
    tags: Array.isArray(p.tags) ? p.tags.map((t) => t.name).filter(Boolean) : null,
    releases: Array.isArray(p.releases)
      ? p.releases.map((r) => ({ name: r.name ?? r.tag_name, tag: r.tag_name, publishedAt: r.published_at }))
      : null,
    contributors: Array.isArray(p.contributors) ? p.contributors.length : null,
    issueTemplateKnown: probeFound(p.issueTemplateProbe),
    securityPolicyKnown: probeFound(p.securityProbe),
    // Raw three-state probes ('known-present'/'known-absent'/'unknown' or a
    // legacy fixture shape): 'unknown' means claim nothing.
    issueTemplateProbeState: typeof p.issueTemplateProbe === 'string' ? p.issueTemplateProbe : null,
    securityProbeState: typeof p.securityProbe === 'string' ? p.securityProbe : null,
    stargazerTimestamps,
    starSample,
    recentStarEvents28,
    eventsPresent: Array.isArray(p.events),

    community: p.community ?? null,

    readme: readmeText ? parseReadme(readmeText) : null,

    now,
  };
}

function ok(settled) {
  if (settled.status === 'fulfilled') return settled.value;
  // A rate limit mid-collection must abort the audit — otherwise every
  // failed sub-fetch degrades into fabricated "missing license / no tests"
  // evidence, which is the one thing a diagnostic tool must never do.
  if (settled.reason instanceof RateLimitError) throw settled.reason;
  return null;
}

export async function fetchPayloads(client, owner, name, { langOverride } = {}) {
  const repo = await client.get(`/repos/${owner}/${name}`);
  const full = repo.full_name;

  const lastStarPage = Math.ceil((repo.stargazers_count ?? 0) / 100) || 1;
  const starAccept = { accept: 'application/vnd.github.star+json' };

  const [
    languages, community, contents, tags, releases,
    contributors, stargazers, packageJson, readme, workflows, events,
  ] = await Promise.allSettled([
    client.get(`/repos/${full}/languages`),
    client.get(`/repos/${full}/community/profile`),
    client.get(`/repos/${full}/contents`),
    client.get(`/repos/${full}/tags?per_page=30`),
    client.get(`/repos/${full}/releases?per_page=10`),
    client.get(`/repos/${full}/contributors?per_page=100`),
    client.get(`/repos/${full}/stargazers?per_page=100&page=${lastStarPage}`, starAccept),
    client.get(`/repos/${full}/contents/package.json`),
    client.get(`/repos/${full}/readme`),
    client.get(`/repos/${full}/actions/workflows?per_page=100`),
    client.get(`/repos/${full}/events?per_page=100`),
  ]);

  // The community-profile endpoint is known to lag reality (issue templates and
  // SECURITY.md missing from it for repos that have them). When it claims
  // absence, cheap contents probes verify before claiming absence. Probe states:
  //   'known-present' — file/dir confirmed to exist
  //   'known-absent'  — probe got a 404: genuinely absent
  //   'unknown'       — profile fetch failed (or probe errored): claim nothing
  const communityPayload = ok(community);
  const needsTemplateProbe = Boolean(communityPayload) && !communityPayload?.files?.issue_template;
  const needsSecurityProbe = Boolean(communityPayload) && !communityPayload?.files?.security_policy;
  const [templateProbeResult, securityProbeResult] = await Promise.all([
    needsTemplateProbe ? probe(client, `/repos/${full}/contents/.github/ISSUE_TEMPLATE`) : undefined,
    needsSecurityProbe ? probe(client, `/repos/${full}/contents/SECURITY.md`) : undefined,
  ]);
  const probeState = (profileHas, probeResult) => {
    if (profileHas) return 'known-present';
    if (probeResult === undefined) return 'unknown'; // probe skipped or errored
    return probeResult == null ? 'known-absent' : 'known-present';
  };

  return {
    repo,
    languages: ok(languages) ?? {},
    community: communityPayload,
    // Null means the fetch was refused — checks must skip, never claim
    // "empty repo" (a 403 on /contents would otherwise fabricate
    // "no manifest / no examples / no tests").
    contents: ok(contents),
    tags: ok(tags),
    releases: ok(releases),
    contributors: ok(contributors),
    stargazers: ok(stargazers),
    events: ok(events),
    packageJson: ok(packageJson),
    readme: ok(readme),
    workflows: ok(workflows),
    issueTemplateProbe: probeState(communityPayload?.files?.issue_template, templateProbeResult),
    securityProbe: probeState(communityPayload?.files?.security_policy, securityProbeResult),
    langOverride: langOverride ?? null,
  };
}

// The community-profile endpoint is known to lag reality (issue templates and
// SECURITY.md missing from it for repos that have them). When it claims
// absence, one cheap contents probe prevents a confident false claim.
async function probe(client, path) {
  try {
    const r = await client.get(path);
    return Array.isArray(r) ? r.map((f) => f.name) : r.name ?? true;
  } catch (err) {
    if (err instanceof NotFoundError) return null; // 404 => genuinely absent
    return undefined; // other errors => we don't claim either way
  }
}

export async function collectFacts(client, owner, name, opts = {}) {
  const payloads = await fetchPayloads(client, owner, name, opts);
  return buildFacts(payloads, { now: new Date() });
}
