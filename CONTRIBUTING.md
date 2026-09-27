# Contributing to why-no-stars

Thanks for helping diagnose the internet's neglected repos. 🩺

## Dev setup

```bash
git clone https://github.com/paopaonb666/why-no-stars
cd why-no-stars
node --version        # >= 18
npm test              # node:test, zero dev dependencies
```

There is nothing to `npm install`. The project has **zero dependencies** on purpose — please keep it that way.

## Adding a check (the most common contribution)

1. Pick the pillar your check belongs to in `src/checks/` (or propose a new pillar in an issue first).
2. Add a function call to that pillar's exported array. A check is one `check(...)` call:

```js
out.push(
  check('my-check-id', 'trust', { en: 'My check', zh: '我的检查' }, {
    status: someCondition ? 'pass' : 'fail',   // 'pass' | 'warn' | 'fail' | 'skip'
    detail: { en: `Found X at line ${n}`, zh: `在第 ${n} 行找到 X` },
    fix: { en: 'Do Y.', zh: '去做 Y。' },
    impact: 'high',                            // 'high' | 'medium' | 'low'
  })
);
```

Rules:

- **Every non-pass check must carry evidence** in `detail` (a line number, a count, a name). No vibes-based findings.
- **Every fail must come with a `fix`** a human can act on in one sitting.
- `status: 'skip'` means "cannot evaluate" (missing data) — skipped checks are excluded from scoring. Never fake a pass/fail from missing data.
- Bilingual strings: `{ en, zh }`. If you can't write Chinese, open the PR anyway — someone will translate.
- Add a test in `test/` (fixtures live in `test/fixtures/`, recorded via `node scripts/record-fixture.mjs owner/repo`).
- Update the checks count in both READMEs if you cross a round number.

## Test data ethics

Fixtures must come from public repos only, and never include personal data beyond public repo metadata.

## Style

- Plain ESM JavaScript, Node >= 18, no build step.
- Comments explain constraints, not history.
- Terminal output must survive `NO_COLOR`, non-TTY, and CJK locale widths.

## Submitting

1. `npm test` green.
2. One PR = one check (or one coherent feature).
3. Describe the *evidence* your check uses and why it predicts adoption.
