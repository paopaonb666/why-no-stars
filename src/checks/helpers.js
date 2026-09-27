// Check result helpers. Every check returns a uniform shape:
// { id, pillar, title: {en,zh}, status, score, detail: {en,zh}, fix: {en,zh}, impact }

export const IMPACT_RANK = { high: 3, medium: 2, low: 1 };

export function check(id, pillar, title, { status, detail, fix, impact = 'low' }) {
  const score = status === 'pass' ? 1 : status === 'warn' ? 0.5 : status === 'skip' ? null : 0;
  return { id, pillar, title, status, score, detail: detail ?? null, fix: fix ?? null, impact };
}

export const YES = { en: 'Yes', zh: '是' };
