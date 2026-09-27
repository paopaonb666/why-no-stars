// Data collection: turn GitHub API payloads into a single "facts" object.
// fetchPayloads  = network side (mockable / recordable for fixtures)
// buildFacts     = pure transform (unit-testable)

import { RateLimitError } from './api.js';

const INSTALL_RE =
  /(?:^|[\s`(])(npm (?:i|install|ci)\b|pnpm (?:add|install)\b|yarn (?:add|install)\b|bun (?:add|install)\b|pip install\b|pip3 install\b|uv (?:pip install|add|tool install|run)\b|cargo (?:add|install)\b|go install\b|brew install\b|conda install\b|gem install\b|composer require\b|dotnet add package\b|docker (?:run|pull)\b|npx \S+|uvx \S+)/;

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
  const lines = text.split(/\r?\n/);
  const headings = [];
  const images = [];
  const codeBlocks = [];
  let inFence = false;
  let fenceStart = 0;
  let badges = 0;

  lines.forEach((line, i) => {
    const n = i + 1;
    if (!inFence) {
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) headings.push({ level: h[1].length, text: h[2].trim(), line: n });
      // Images inside code fences are documentation of syntax, not rendered
      // visuals — excluding them keeps hero-visual/badges honest.
      for (const m of line.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)) {
        const url = m[1];
        images.push({ url, line: n });
        if (
          n <= 45 &&
          /(badge|shields\.io|travis|circleci|codecov|coveralls|npmjs|pypi|crates\.io|goreportcard|deepwiki)/i.test(url)
        ) {
          badges++;
        }
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
    hasManifest: rootFiles.some((f) => manifestNames.includes(f.name)),
    packageJson,
    workflows: p.workflows ?? { total_count: 0, workflows: [] },
    tags: (p.tags ?? []).map((t) => t.name).filter(Boolean),
    releases: (p.releases ?? []).map((r) => ({
      name: r.name ?? r.tag_name,
      tag: r.tag_name,
      publishedAt: r.published_at,
    })),
    contributors: Array.isArray(p.contributors) ? p.contributors.length : 0,
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

  return {
    repo,
    languages: ok(languages) ?? {},
    community: ok(community),
    contents: ok(contents) ?? [],
    tags: ok(tags) ?? [],
    releases: ok(releases) ?? [],
    contributors: ok(contributors) ?? [],
    stargazers: ok(stargazers),
    events: ok(events),
    packageJson: ok(packageJson),
    readme: ok(readme),
    workflows: ok(workflows) ?? { total_count: 0, workflows: [] },
    langOverride: langOverride ?? null,
  };
}

export async function collectFacts(client, owner, name, opts = {}) {
  const payloads = await fetchPayloads(client, owner, name, opts);
  return buildFacts(payloads, { now: new Date() });
}
