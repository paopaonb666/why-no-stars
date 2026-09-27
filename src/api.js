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

// A non-auth, non-rate-limit, non-404 HTTP error (403-with-quota, 5xx, …).
// Carries status/path so the CLI can print a friendly line instead of a stack.
export class ApiError extends Error {
  constructor(status, path, hint = '') {
    super(`GitHub API returned ${status} for ${path}.${hint ? ` ${hint}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.path = path;
  }
}

export const DEFAULT_TIMEOUT_MS = 20_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class GitHubClient {
  constructor({
    token, baseUrl = 'https://api.github.com', fetchImpl = fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS, retryDelayMs = 400, retries = 1, etagStore = null,
  } = {}) {
    this.token = token ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? null;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.retries = retries;
    // Optional persistent etag store: revalidation (304) doesn't cost quota.
    this.etagStore = etagStore;
    this.cache = new Map();
    this.lastRemaining = null;
    this.conditionalHits = 0;
  }

  async get(path, { accept } = {}) {
    const key = accept ? `${path}|${accept}` : path;
    if (this.cache.has(key)) return this.cache.get(key);

    const stored = this.etagStore?.get(key) ?? null;
    const headers = {
      Accept: accept ?? 'application/vnd.github+json',
      'User-Agent': 'why-no-stars',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (stored) headers['If-None-Match'] = stored.etag;

    // One retry for transient failures only — dead connections and 502/503/504
    // blips (common on long routes to api.github.com). 4xx never retries.
    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await this.fetchImpl(this.baseUrl + path, {
          headers,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        if (attempt < this.retries) {
          await sleep(this.retryDelayMs);
          continue;
        }
        throw new NetworkError(path, err);
      }
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining !== null) this.lastRemaining = Number(remaining);

      if (res.status === 304 && stored) {
        // Revalidated: the stored body is still the server's truth, at no
        // quota cost.
        this.conditionalHits++;
        this.cache.set(key, stored.data);
        return stored.data;
      }
      if (res.status === 404) throw new NotFoundError(path);
      if (res.status === 401) throw new AuthError(path);
      if (res.status === 403 || res.status === 429) {
        if (remaining === '0' || res.status === 429) {
          const reset = Number(res.headers.get('x-ratelimit-reset')) * 1000;
          throw new RateLimitError(reset);
        }
        // A 403 with quota left is usually a secondary rate limit or a resource
        // restriction — both clear on their own, so say so instead of a bare 403.
        throw new ApiError(403, path, 'Forbidden — often a secondary rate limit; waiting a minute or adding GITHUB_TOKEN usually clears it.');
      }
      if ([502, 503, 504].includes(res.status) && attempt < this.retries) {
        await sleep(this.retryDelayMs);
        continue;
      }
      if (!res.ok) throw new ApiError(res.status, path);

      const data = await res.json();
      const etag = res.headers.get('etag');
      if (etag && this.etagStore) this.etagStore.put(key, etag, data);
      this.cache.set(key, data);
      return data;
    }
  }

  async getSearch(path) {
    // Search API has its own, much lower rate limit; failures are non-fatal.
    return this.get(path);
  }
}
