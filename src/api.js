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

// DNS failure, refused connection, or the request aborting on timeout.
// Distinguished from an HTTP error so the CLI can say "your network" instead
// of dumping a stack trace.
export class NetworkError extends Error {
  constructor(path, cause) {
    const timedOut = cause?.name === 'TimeoutError' || cause?.cause?.name === 'TimeoutError';
    super(
      timedOut
        ? `Request to ${path} timed out.`
        : `Network request to ${path} failed: ${cause?.message ?? 'unknown error'}.`
    );
    this.name = 'NetworkError';
    this.path = path;
    this.timedOut = timedOut;
  }
}

export const DEFAULT_TIMEOUT_MS = 20_000;

export class GitHubClient {
  constructor({ token, baseUrl = 'https://api.github.com', fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.token = token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
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

    let res;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        headers,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new NetworkError(path, err);
    }
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (remaining !== null) this.lastRemaining = Number(remaining);

    if (res.status === 404) throw new NotFoundError(path);
    if (res.status === 401) throw new AuthError(path);
    if (res.status === 403 || res.status === 429) {
      if (remaining === '0' || res.status === 429) {
        const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
        throw new RateLimitError(reset);
      }
      // A 403 with quota left is usually a secondary rate limit or a resource
      // restriction — both clear on their own, so say so instead of a bare 403.
      throw new Error(
        `GitHub API returned 403 for ${path} (forbidden — often a secondary rate limit; waiting a minute or adding GITHUB_TOKEN usually clears it).`
      );
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
