// Minimal ANSI styling helper. Zero dependencies.
// Respects NO_COLOR env, TTY detection, and explicit --color/--no-color flags.

let mode = 'auto'; // 'auto' | 'always' | 'never'

export function setColorMode(m) {
  mode = m;
}

export function useColor() {
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdout.isTTY);
}

const wrap = (code) => (s) => (useColor() ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const bold = wrap('1');
export const dim = wrap('2');
export const red = wrap('31');
export const green = wrap('32');
export const yellow = wrap('33');
export const blue = wrap('34');
export const magenta = wrap('35');
export const cyan = wrap('36');
export const gray = wrap('90');
export const white = wrap('97');

// Visual width of a string, counting CJK/fullwidth chars as 2 columns.
export function vwidth(s) {
  let w = 0;
  for (const ch of String(s)) w += ch.codePointAt(0) > 0xff ? 2 : 1;
  return w;
}

export function padEnd(s, n) {
  s = String(s);
  const w = vwidth(s);
  return w >= n ? s : s + ' '.repeat(n - w);
}

export function padStart(s, n) {
  s = String(s);
  const w = vwidth(s);
  return w >= n ? s : ' '.repeat(n - w) + s;
}

// Strip ANSI codes (for width computation of already-styled strings is NOT
// handled by vwidth; style plain strings and pad before styling).
export function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

// Repo-controlled text (descriptions, README strings, tag names) must never
// carry terminal escape sequences or control chars into a report — a crafted
// description could otherwise repaint the terminal. ANSI sequences are removed
// whole (including 8-bit CSI); other C0/C1 controls, non-characters, and lone
// surrogates become spaces / are dropped, keeping SVG output valid XML 1.0.
export function sanitize(s) {
  return String(s)
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\u009b[0-9;?]*[A-Za-z]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\uFFFE\uFFFF]/g, ' ')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}
