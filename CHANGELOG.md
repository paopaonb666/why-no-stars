# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org).

## [Unreleased]

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
