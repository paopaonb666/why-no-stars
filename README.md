<div align="center">

# 🔍 why-no-stars

**Find out exactly why your repo isn't getting stars.**

31 evidence-backed checks · ecosystem star-percentile benchmark · one shareable scorecard.
Zero dependencies. Zero config. No API key required.

[![CI](https://github.com/paopaonb666/why-no-stars/actions/workflows/ci.yml/badge.svg)](https://github.com/paopaonb666/why-no-stars/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](./package.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)
[![Stars](https://img.shields.io/github/stars/paopaonb666/why-no-stars?style=social)](https://github.com/paopaonb666/why-no-stars/stargazers)

<img src="./examples/got-scorecard.svg" alt="why-no-stars scorecard for sindresorhus/got" width="720">

[English](#english) · [中文文档](./README.zh-CN.md)

</div>

---

<a name="english"></a>

## The pitch

You built something good. It works, it's tested, you pushed it with pride.
It has **47 stars**. Fourteen are your own alt accounts (we won't tell).

**You don't have a marketing problem. You have a first-10-seconds problem.**
A visitor lands on your repo, skims for a reason to care, and bounces. `why-no-stars` is the doctor that tells you *exactly* where they're bouncing — with evidence, not vibes:

```text
  ⚡ Top fixes
  1. [HIGH] Install command near the top
     First installable command at line 62
     → Move the copy-paste install one-liner into the first screen of the README.
  2. [HIGH] Hero image / GIF above the fold
     No image in the README at all.
     → Put a screenshot/GIF/demo within the first ~30 lines.
  3. [MED ] Issue template
     No issue template.
     → Add .github/ISSUE_TEMPLATE with bug + feature forms.
```

Every finding cites its evidence (`line 62`, `0 badges`, `last push 214 days ago`), so you can disagree with the diagnosis — but you can't ignore it.

## Quick start

```bash
# no install needed (runs from GitHub)
npx github:paopaonb666/why-no-stars <owner/repo>

# or clone & run
git clone https://github.com/paopaonb666/why-no-stars && cd why-no-stars
node bin.js <owner/repo>
```

```bash
wns sindresorhus/got                 # terminal scorecard
wns me/my-project --svg card.svg     # shareable 1200x630 scorecard
wns me/my-project --md report.md     # paste-ready Markdown report
wns me/my-project --zh               # 中文报告
```

> **No API key needed.** Unauthenticated GitHub allows 60 requests/hour (~4 audits).
> Set `GITHUB_TOKEN` for 5,000/hour: `GITHUB_TOKEN=ghp_xxx wns me/my-project`.

## What it measures — six pillars

| Pillar | Weight | The question it answers |
|---|---|---|
| **First impression** | 25 | Would a stranger care in the first 10 seconds? |
| **Time-to-hello-world** | 20 | How fast can someone go from interested to running it? |
| **Trust & maintenance** | 20 | Is this safe to adopt, or a digital ghost town? |
| **Community health** | 15 | Do the first outsiders have roads to arrive on? |
| **Discoverability** | 10 | Can someone searching for this actually find it? |
| **Momentum** | 10 | Is anything arriving, or is it perfectly still? |

Across these pillars it runs **31 checks** — each with a status, evidence, an impact rating, and a concrete fix. Sample checks: install one-liner above the fold, hero image, license, tests, CI, release hygiene, issue templates, topics, star velocity, ecosystem percentile.

## The benchmark nobody else gives you: your percentile

Scoring your repo against abstract best practices is easy. `why-no-stars` also tells you **where you stand in your language's ecosystem**. It counts every repo in your primary language by star bucket (0, 1–9, 10–99, 100–999, 1k–10k, 10k+) via the GitHub search API, then reports an honest **range**:

```text
expressjs/express: 91/100 (S) · more stars than 99–100% of peers
```

```text
me/my-project: 38/100 (F) · more stars than 30–45% of peers
```

A range, because you only know your bucket — we won't invent precision we don't have.

## Everything at a glance

```bash
wns me/my-project --svg scorecard.svg --json report.json --md report.md --zh
```

| Flag | What it does |
|---|---|
| `--svg <file>` | 1200×630 shareable scorecard (OG-image sized — perfect for READMEs and social) |
| `--json <file>` | Machine-readable report (CI bots, dashboards) |
| `--md <file>` | Markdown report to paste into an issue or discussion |
| `--zh` / `--en` | Output language (auto-detected from `LANG` by default) |
| `--no-benchmark` | Skip the percentile (saves 6 API calls) |
| `--token <t>` | GitHub token (else `GITHUB_TOKEN`/`GH_TOKEN`) |
| `--quiet` | One line: score + grade + percentile |

Exit codes: `0` ok · `1` error (repo not found, etc.) · `2` rate-limited.

## Sample: a real audit of a famous repo

We audited [`sindresorhus/got`](https://github.com/sindresorhus/got) — one of the most polished repos on GitHub:

```text
  Overall  91/100  [S]          Ecosystem: more stars than 99–100% of TypeScript repos

  First impression     ████████░░   75  (w 25)
  Time-to-hello-world  ██████████  100  (w 20)
  Trust & maintenance  ██████████  100  (w 20)
  Community health     █████████░   90  (w 15)
  Discoverability      █████████░   88  (w 10)
  Momentum             ██████████  100  (w 10)

  ⚡ Top fixes
  1. [HIGH] Hero image / GIF above the fold
     First image at line 54
  2. [HIGH] Install command near the top
     First installable command at line 71
```

Even an S-grade repo gets concrete, actionable feedback. That's the point — this is not a vanity score.

## We audit ourselves

Dogfooding is not optional here. This is `why-no-stars` auditing **this very repo**, minutes after launch — honest numbers, including the ugly ones:

<img src="./examples/self-scorecard.svg" alt="why-no-stars auditing itself: 82/100 at launch" width="640">

Momentum is 0 because we launched today, and the tool refuses to pretend otherwise. The README, community templates, and release hygiene are already maxed — the only missing pillar is the one you're holding. 😉

## FAQ

**Is this just a README linter?**
No. A linter checks text. `why-no-stars` diagnoses *conversion*: it benchmarks you against your whole language ecosystem, ranks fixes by expected impact, and cites evidence for every claim.

**Is the score meaningful?**
It's a mirror, not a verdict. The pillars are the signals experienced maintainers check before adopting a dependency, encoded as checks. The score won't write your code — it tells you which 10-minute fix moves the needle first.

**Will it hurt my feelings?**
Possibly. The grades go down to **F**. We recommend running it, fixing the top 3, and running it again — the score is a to-do list, not a judgment of your worth as a developer.

**Private repos?** Pass a token; private repos work the same way.

**Can it be wrong?** Yes — it's heuristics over the GitHub API, no LLM, no magic. When it's wrong, that's a bug: [please report it](https://github.com/paopaonb666/why-no-stars/issues).

## Limitations

- Findings are heuristic (regex + API metadata), intentionally offline and deterministic. No repo code is uploaded anywhere.
- The percentile compares star *counts* across your primary language; it doesn't normalize by repo age yet (on the roadmap).
- Star recency for very large repos (>~40k stars) is a lower bound sampled from the public events feed, because GitHub caps deep stargazers pagination.

## Roadmap

- [ ] `wns --local .` — audit a local folder without the API
- [ ] Age-normalized percentile (comparing against repos of similar age)
- [ ] `--watch` mode: re-audit on a schedule and track pillar deltas
- [ ] GitHub Action: post a scorecard on every README change
- [ ] Per-pillar percentile vs. a peer sample of similar-size repos

## Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Adding a new check is ~30 lines: a function that takes facts and returns `{ status, detail, fix, impact }`. The [check registry](./src/checks) is deliberately boring on purpose.

## License

[MIT](./LICENSE) © 2026 paopaonb666

---

<div align="center">

**Stars aren't luck. They're the first 10 seconds, done right.**

If this tool found something useful for your repo, star it — you know exactly what that's worth now. 😉

</div>
