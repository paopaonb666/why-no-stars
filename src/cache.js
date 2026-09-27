// On-disk cache: fresh-enough API data and run history, so repeat audits are
// fast, rate-limit-friendly, and comparable ("▲ +3 since last run").
// Best-effort by design: any read/write failure returns null / no-ops — the
// cache must never take a live audit down.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, posix, win32 } from 'node:path';
import { homedir } from 'node:os';

export const REPO_TTL_MS = 30 * 60 * 1000;      // repo payloads: fresh enough for "did my fix land?" loops
export const SEARCH_TTL_MS = 24 * 60 * 60 * 1000; // ecosystem bucket counts: huge aggregates, change slowly

// Cache location is user-level (auditing other people's repos must not drop
// directories into the user's cwd). WNS_CACHE_DIR overrides for tests.
export function resolveCacheDir({ env = process.env, home = homedir(), platform = process.platform } = {}) {
  // Follow the platform parameter, not the host, so the function behaves the
  // same in tests on any OS (and real usage always matches the host anyway).
  const p = platform === 'win32' ? win32 : posix;
  if (env.WNS_CACHE_DIR) return env.WNS_CACHE_DIR;
  if (platform === 'win32') {
    return p.join(env.LOCALAPPDATA ?? p.join(home, 'AppData', 'Local'), 'why-no-stars', 'cache');
  }
  return p.join(env.XDG_CACHE_HOME ?? p.join(home, '.cache'), 'why-no-stars');
}

function safeFile(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, '_');
}

// Returns { at, data } or null (missing / corrupt / older than maxAgeMs).
export function readEntry(dir, file, { maxAgeMs = 0 } = {}) {
  try {
    const obj = JSON.parse(readFileSync(join(dir, safeFile(file)), 'utf8'));
    if (typeof obj?.at !== 'number' || !('data' in obj)) return null;
    if (maxAgeMs > 0 && Date.now() - obj.at > maxAgeMs) return null;
    return obj;
  } catch {
    return null;
  }
}

export function readData(dir, file, opts = {}) {
  return readEntry(dir, file, opts)?.data ?? null;
}

export function writeData(dir, file, data) {
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, safeFile(file)), JSON.stringify({ at: Date.now(), data }), 'utf8');
    return true;
  } catch {
    return false;
  }
}

// "12 min ago" / "3 h ago" / "5 d ago" for cache-hit and delta notes.
export function fmtAge(ms, locale = 'en') {
  const zh = locale === 'zh';
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return zh ? `${min} 分钟` : `${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return zh ? `${h} 小时` : `${h} h`;
  return zh ? `${Math.round(h / 24)} 天` : `${Math.round(h / 24)} d`;
}
