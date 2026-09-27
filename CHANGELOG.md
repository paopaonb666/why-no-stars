# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org).

## [Unreleased]

## [1.1.0] — 2026-09-27

The correctness release, from a second multi-agent audit (README/positioning, scoring methodology, real-repo red-team).

### Fixed
- **The parser no longer lies about famous repos**: HTML `<img>`/`<h1>-<h6>` are now parsed, HTML comments are stripped (a commented-out badge counted as got's "hero image"), badge images no longer count as hero visuals, and setext titles (`Title\n====`) are recognized. got: 90 → 93.
- **API refusal is no longer "zero"**: the Linux kernel's contributor list (20k+ people) 403s on the API — previously reported as "0 contributors" FAIL. Refused data now *skips* with an explanation instead of fabricating evidence.
- **License `NOASSERTION` no longer slandered**: a detected-but-unidentified license (Linux's GPL-2.0 COPYING) warns with guidance instead of failing with "legally unusable".
- **Community-profile staleness**: when GitHub's profile endpoint claims a missing issue template / SECURITY.md, a cheap contents probe verifies before claiming absence (react's templates now detected).
- **Forks are scored honestly**: inherited tags/releases/contributors are skipped, not credited.
- **Archived repos get sane advice**: impossible fixes (push, add templates) are suppressed from Top fixes; the report is labeled ARCHIVED.
- Tests detection broadened (nested test dirs, test-runner configs) and softened for manifest-less ecosystems (kernels, native code).
- Semver accepts X.Y (kernel-style) and prerelease tags; name-quality no longer flags "newsletter".
- Star velocity prefers the last-90-day window when full history is known (a once-viral dead repo no longer passes forever).
- A >1200-line README warns instead of failing; hero/above-the-fold thresholds unified.

### Changed
- **Quick wins now ranked by recoverable points** (pillar weight ÷ checks in pillar), deduped by root cause — the two install-command checks no longer burn two of three slots.
- **Benchmark split into 7 buckets** (0 / 1–2 / 3–9 / …) with a 300ms stagger to dodge the search secondary rate limit; sub-10-star repos now get context: "90% of peers have 0 stars; median peer: 0".
- Pillar bars show per-check influence (`w 25 · 8 checks`).
- README: hero is now the tool's own audit; all examples use commands that exist today; explicit "measures presentation, not code quality" scope note.

### Added
- `security-policy` probe-based verification; zh wording polish across both READMEs.

## [1.0.1] — 2026-09-27

### Fixed
- Exit codes: every failure path (bad slug, unknown flag, not-found, rate limit) now propagates its code; previously all exits were 0.
- A rejected/typo'd GitHub token no longer crashes with a stack trace — it prints a friendly 401 message.
- Rate limiting mid-audit no longer fabricates "missing license / no tests" evidence; the audit aborts with guidance instead.
- Star-recency sampling for repos with 101–199 stars (partial last page was discarded and misreported).
- Images/badges inside README code fences are no longer counted as rendered visuals.
- Terminal icon styling now respects `--color` on non-TTY output; `last pushed` line is localized in Chinese output.
- Markdown report: evidence containing `|` or newlines can no longer break the table.
- SVG scorecard: text escaping hardened; layout re-rhythmized after visual review (no more footer/last-row collision).

### Added
- Progress indication on stderr while collecting data (~13 API calls, previously a silent 6–8s).
- `security-policy` check (32 checks total now): flags repos without SECURITY.md.
- Value-taking flags (`--svg/--json/--md/--lang/--token`) now error instead of silently swallowing the next argument.
- CHANGELOG, SECURITY policy, dependabot (GitHub Actions), .editorconfig, .nvmrc; CI matrix updated to Node 20/22/24 incl. Windows.

### Changed
- Percentile phrasing unified to one honest metric: "more stars than X–Y% of peers".

## [1.0.0] — 2026-09-27

### Added
- Initial release: 31 checks across 6 pillars, ecosystem star-percentile benchmark, shareable 1200×630 SVG scorecard, terminal/Markdown/JSON reports, bilingual output (en/zh), zero dependencies.
