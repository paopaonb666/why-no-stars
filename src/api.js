// GitHub REST API client. Zero dependencies (Node >= 18 global fetch).

export class RateLimitError extends Error {
  constructor(resetMs) {
    const when = Number.isFinite(resetMs) ? new Date(resetMs).toISOString() : 'soon';
    super(`GitHub API rate limit exceeded. Resets at ${when}.`);
    this.name = 'RateLimitError';
    this.resetMs = Number.isFinite(resetMs) ? resetMs : null;
  }
}

export class AuthError extends Error {
  constructor(path) {
    super(`GitHub rejected the token (401) for ${path}.`);
    this.name = 'AuthError';
    this.path = path;
  }
}

export class NotFoundError extends Error {
  constructor(path) {
    super(`Not found: ${path}`);
    this.name = 'NotFoundError';
    this.path = path;
  }
}

export class GitHubClient {
  constructor({ token, baseUrl = 'https://api.github.com' } = {}) {
    this.token = token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.cache = new Map();
    this.lastRemaining = null;
  }

  async get(path, { accept } = {}) {
    const key = accept ? `${path}|${accept}` : path;
    if (this.cache.has(key)) return this.cache.get(key);

    const headers = {
      Accept: accept ?? 'application/vnd.github+json',
      'User-Agent': 'why-no-stars',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(this.baseUrl + path, { headers });
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== null) this.lastRemaining = Number(remaining);

    if (res.status === 404) throw new NotFoundError(path);
    if (res.status === 401) throw new AuthError(path);
    if (res.status === 403 || res.status === 429) {
      if (remaining === '0' || res.status === 429) {
        const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
        throw new RateLimitError(reset);
      }
      throw new Error(`GitHub API returned 403 for ${path} (forbidden).`);
    }
    if (!res.ok) throw new Error(`GitHub API returned ${res.status} for ${path}.`);

    const data = await res.json();
    this.cache.set(key, data);
    return data;
  }

  async getSearch(path) {
    // Search API has its own, much lower rate limit; failures are non-fatal.
    return this.get(path);
  }
}
