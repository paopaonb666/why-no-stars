# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org).

## [1.2.0] — 2026-10-09 · the final release

The project is concluded on purpose: it works, the tests pass (99/99), and it stops here. Unexecuted plans (npm publish, launch posts, the roadmap) were removed rather than left dangling; the publish workflow and Dependabot config went with them, and the repository is archived. `npx github:paopaonb666/why-no-stars <owner/repo>` keeps working straight from the git source.

### Removed (conclusion)
- `docs/LAUNCH.md` and `docs/launch/` — the launch playbook and post drafts, never executed.
- The README roadmap sections (both languages) and their references.
- `.github/workflows/publish.yml` — publishing was never done and is cancelled with the project.
- `.github/dependabot.yml` — a concluded repo takes no dependency updates.

### Changed (self-audit round)
- **Dogfooded the tool on this repo and applied its own advice**: both warnings fixed (About homepage URL set; Docs/文档 sections added to both READMEs linking the self-report and generated examples) — self score 85 → 89, `examples/self-scorecard.svg` / `examples/self-report.json` / `docs/self-report.md` regenerated from the post-fix audit. Remaining deductions are honest ones: 1 contributor, 0 stars.
- README/CHANGELOG synced with the round 2–3 code that was already shipped (quick-win `+X.X pts` labels, `--no-cache` / `--fail-under` / delta line, exit code 10).
- `.gitignore` now excludes local-only working files (internal optimization reports, personal workbench).

### Added (round 3)
- **ETag conditional requests** (`src/cache.js` + `src/api.js`): etags stored per request; past the TTL the client revalidates with `If-None-Match` and GitHub answers 304 **without charging the rate limit** — repeat audits cost ~0 quota instead of ~13 calls, decisive for the unauthenticated 60 req/h budget. Conditional hits are surfaced on stderr.
- **`-` stdout output**: `--svg -`, `--json -`, `--md -` print to stdout for piping.
- **Translated-README detection**: `readme-exists` detail lists `README.zh-CN.md`-style variants found at root (detail-only; the score must not depend on language).
- **Copy-paste CI gate workflow** (`examples/ci-gate.yml`): scheduled scorecard audit with `--fail-under`, artifact upload, and the exit-code contract documented inline.
- **Score tripwire**: the got fixture pins 92/S at a fixed date — any scoring-methodology change must update the pin deliberately.
- Terminal rule lines shrink for narrow terminals (non-TTY keeps the 64-col design).

### Fixed (round 3 — six honesty holes found by parallel red-team audits)
- **license**: a refused community profile no longer fails repos whose repo payload carries a valid SPDX (pass, "from repo metadata"); no license info anywhere → skip, never "No detectable license".
- **community**: profile file values are objects and rendered as "Found: [object Object]" — now normalized to file names.
- **community**: an errored (non-404) contents probe skips with "cannot confirm either way" instead of confidently claiming absence.
- **recent-activity**: unknown `pushed_at` skips instead of failing with an "abandoned" fix contradicting its own "unknown" detail.
- **title-match**: README-less repos skip (covered by readme-exists) instead of double-punishing.
- **examples-dir / manifest / tests / ci**: a refused `/contents` or `/workflows` fetch degrades to skip with "API refused" details — never to "no manifest / no tests / no CI".
- **`--lang` no longer leaks through the repo cache** (payloads are cached lang-free; the flag is applied per-run).
- **markdown**: cells escape backslashes before pipes — a literal `\|` in repo text could still split a table row.
- **zh output**: no more English leaks (invalid-repo error, `--help` hint, SVG "ARCHIVED" → 「已归档」).
- **CLI**: empty flag values (`--md=`, `--fail-under=`) are rejected loudly instead of silently disabling output/the gate; `--fail-under` validated by `^\d+$`.

### Added (round 2)
- **On-disk cache** (`src/cache.js`): user-level cache (LOCALAPPDATA / XDG); repo payloads 30 min, benchmark counts 24 h, run history kept. Repeat audits are fast and rate-limit-friendly; corrupt/unwritable caches never take an audit down. `--no-cache` skips all reads and writes; `WNS_CACHE_DIR` overrides the location.
- **Run-over-run delta**: the report now shows your progress — `▲ +3 pts (your run 2 h ago: 90)` in the terminal, `(▲+3 vs last run)` in `--quiet`, a `delta` object in JSON.
- **Stale fallback under rate limits**: when a fresh fetch is rate-limited but a cache exists, the audit renders from cache and is clearly flagged STALE (terminal banner + JSON `stale` field) instead of failing.
- **`--fail-under <n>` CI gate**: exits `10` when the overall score is below `<n>` (distinct from `1` tool failure and `2` rate limit) so pipelines can gate on the scorecard.
- **facebook/react live fixture** (758 KB): regression-tests the mega-repo paths against real data — deep-pagination cap → `starSample: 'none'` → events-feed fallback — and documents react's honest FAILs (no install one-liner, no hero image in the README).
- `npm run test:coverage` — 89% lines / 81% branches.
- JSON reports carry `schema: 1` for forward compatibility.

### Fixed (round 3 — API-layer audit, second wave)
- **A 200 with a non-JSON body** (proxy/captive portal/truncated response) raises a typed ApiError instead of a raw SyntaxError escaping every error mapping.
- **Missing/non-numeric `x-ratelimit-reset`** no longer yields `resetMs: 0` ("Resets at 1970-01-01…"); RateLimitError reports null and the CLI says "soon".
- **probe() rethrows RateLimitError**: quota exhaustion aborts the audit (enabling the stale-cache fallback) instead of limping on with unverified probes.
- **A transient /readme failure is 'unknown', never "No README found"**: fetchPayloads records `readmeState` ('present'/'absent'/'unknown'); a clean 404 is genuine absence, a refused fetch skips honestly.
- **A refused package.json skips the tests check** for manifest-visible repos — the "missing" test script may simply be unfetchable (`packageJsonKnown`).
- **CommonMark fence parsing**: a fence closes only on a bare line of the same char at least as long as the opener — a ``` line no longer closes a ~~~ or 4-backtick fence, so fenced markdown/YAML examples can no longer leak headings/images into evidence; setext detection skips code-block interiors and list+`---` (thematic break) pairs.

### Changed (round 2)
- **Install detection broadened**: deno add/install, dlx runners (pnpm/yarn/bun), `npm exec`, `uv sync`, `cargo binstall`, `dotnet tool install`; matching is now case-insensitive ("NPM INSTALL" counts).
- **License check cross-references package.json**: a contradicting npm `license` field warns (dual-license expressions exempt).
- **Topics check enforces GitHub's hard cap**: >20 topics warn (GitHub silently drops the extras).
- **Releases check detects stalled release trains**: code pushed in the last 90 days but latest release 180+ days old warns.
- **SVG scorecards auto-fit text**: long repo names shrink, then truncate with an ellipsis — the card never overflows its 1200×630 canvas (CJK-aware).
- **API client**: `ApiError` typed; one automatic retry for dead connections and 502/503/504 (4xx never retries); low-quota heads-up on stderr before the benchmark; `fetchPayloads` probes run in parallel.
- **Rendering hardened**: ANSI/control sequences are stripped from all repo-controlled text (a crafted repo description can no longer repaint the terminal); markdown/SVG escaping centralized.
- **Runtime guard**: friendly bilingual error on Node < 18 (no `fetch` there).
- **CI**: workflow token is read-only (`permissions: contents: read`) and concurrent pushes cancel superseded runs.
- Help text (zh): `--no-benchmark` says it saves 7 API calls (was 6).
- Benchmark stagger halved to 150ms (defensive pacing for undocumented secondary limits; documented caps fit a serial burst).
- Quick-wins now display the recovered points (+2.0 pts) instead of a static impact label that could contradict the ordering; archived-repo fixes whitelisted to repo-settings fixes; etag store capped (LRU, 300 files); readme text no longer retained; parseSlug order/dot-segment fixes; NaN/NaN-velocity guards for corrupted caches; bidi/zero-width stripping; README samples refreshed to the pts format.

### Fixed (round 2)
- **Community checks no longer fabricate evidence**: when the community-profile fetch itself failed, `issue-template` and `security-policy` were falsely reported as PASS (a `null && …` fell through to `'known-present'`). Probes are now three-state — `known-present` / `known-absent` / `unknown` — and every file-derived community check honestly *skips* when the data is unavailable.
- **A hung GitHub API no longer hangs the CLI**: every request carries a 20s timeout; DNS failures, refused connections and timeouts surface as a friendly bilingual error (exit 1) instead of a raw stack trace.
- **Output-file failures are handled**: a bad `--md` path no longer swallows the `--svg` output (per-file emit), and any write failure prints a clear message and exits 1.
- **403 with quota remaining** now explains it is usually a secondary rate limit (previously a bare "forbidden").

### Tests
- 45 → **99** tests, all green, ~1s: fake-fetch client coverage (retry paths, ApiError mapping, timeout wiring), probe states, `starPercentile` logic, cache TTL/corruption/safety, JSON report shape, SVG fit, injection regressions.

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
