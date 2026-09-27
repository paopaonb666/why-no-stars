# Reddit — 发布就绪（两个 subreddit，错开 24h）

## 1) r/SideProject — 发布地址 https://www.reddit.com/r/SideProject/submit

**Title:**

```
I built a CLI that diagnoses why your repo isn't getting stars. It audited my own project first: 85/100, momentum honestly 0.
```

**Body (text post):**

```markdown
The pitch is simple: most repos don't have a marketing problem, they have a first-10-seconds problem. A visitor lands, skims, bounces — usually because the install command is buried at line 62, the first "image" is actually a badge, or the last push was 214 days ago.

So I wrote `why-no-stars` — a zero-dependency CLI that audits any public repo like a first-time visitor experiences it. 32 checks across six pillars, every finding cites its evidence ("first installable command at line 71"), and fixes are ranked by how many points each one recovers.

Things I care about:

- It benchmarks you against your language's whole ecosystem: it counts repos per star bucket via GitHub's search API and gives an honest percentile RANGE (no fake precision).
- It refuses to fabricate evidence. When the API withholds data (huge repos 403 on contributor lists), the check is marked "skipped" — never scored as zero. A diagnostic tool that invents findings is worse than none.
- It doesn't flatter famous repos: sindresorhus/got scores 93/S and still gets concrete findings. torvalds/linux gets a gentler verdict with an honest "can't see ecosystem-specific tests" note instead of "no tests lol".
- I dogfooded it: the README shows the tool auditing itself — 85/100, momentum honestly 0 on launch day.

Try it with no install (Node >= 18, no API key needed):

    npx github:paopaonb666/why-no-stars <owner/repo>

MIT, all local, no LLM — heuristics over the GitHub API. When a finding is wrong, that's a bug and I want the issue.

Repo: https://github.com/paopaonb666/why-no-stars

Happy to audit a repo or two in the comments if you drop the link.
```

**After posting:** reply to every comment within the first 2 hours. If someone drops a repo link, actually run the audit and paste the top-3 fixes — that's the product demo.

## 2) r/opensource — 发布地址 https://www.reddit.com/r/opensource/submit (24h later)

**Title:**

```
I audited famous repos with my new CLI and found most "repo health checkers" fabricate evidence. Here's how why-no-stars avoids it (MIT, zero deps).
```

**Body (text post):**

```markdown
While testing my repo-diagnostic CLI on famous projects, I found three failure modes that most audit tools share — mine included, before I fixed them:

1. **Refused data treated as zero.** torvalds/linux's contributor list 403s on GitHub's API (too large). My first version reported "0 contributors — fail". Now: refused data SKIPS with an explanation, never scores as zero.

2. **Source-parsed but visitor-invisible.** got's README has a coverage badge inside an HTML comment. A markdown-only parser counts it as a hero image. Now: comments stripped, HTML img/headings parsed, badges excluded from hero detection.

3. **Inherited credit.** A fork scores its parent's 100 contributors and release history. Now: fork repos skip inherited-data checks honestly.

The tool itself: `npx github:paopaonb666/why-no-stars <owner/repo>` — 32 checks, 6 pillars, ecosystem star-percentile benchmark, zero dependencies, no API key required, MIT: https://github.com/paopaonb666/why-no-stars

The README shows it auditing itself (85/100, momentum honestly 0 on launch day). Would love feedback on the check thresholds — adding a check is ~30 lines and PRs are welcome.
```
