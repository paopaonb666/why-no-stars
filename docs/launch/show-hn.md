# Show HN — publish ready

**When:** the golden window is 8–10 AM US Eastern = **20:00–22:00 Beijing time** (same evening!).
**Where:** https://news.ycombinator.com/submit
**Steps:** log in → submit → paste title → paste the repo URL as the link → post → immediately post the first comment below → reply to every comment for 2 hours.

## Title (paste exactly)

```
Show HN: Why-no-stars – find out why your repo isn't getting stars
```

## URL field

```
https://github.com/paopaonb666/why-no-stars
```

## First comment (post immediately after submitting, as yourself)

```
Hi HN! I built why-no-stars because of a pattern I kept seeing: good projects with bad storefronts. The repo works, it's tested, it has 47 stars — and the install command is buried at line 62 of the README.

why-no-stars is a zero-dependency CLI that audits any public repo the way a first-time visitor experiences it. It runs 32 checks across six pillars (first impression, time-to-hello-world, trust, community, discoverability, momentum), and every finding cites its evidence: "first installable command at line 71", "0 badges", "last push 214 days ago".

Two things I tried hard to get right:

1. It benchmarks you against your language's ecosystem. It counts repos per star bucket via the GitHub search API and reports an honest percentile RANGE — a 90-star TypeScript repo learns it beats 96-98% of peers. GitHub search totals are estimates, so no fake precision.

2. It refuses to fabricate evidence. When the API withholds data (huge repos 403 on contributor lists), the check is marked skipped, never scored as zero. A diagnostic tool that invents findings is worse than no tool.

We dogfood it: the repo's README shows the tool auditing itself (85/100 at launch, momentum honestly 0 because we launched that day). And it doesn't flatter famous repos — sindresorhus/got scores 93/S and still takes home concrete findings.

Try it with no install:

    npx github:paopaonb666/why-no-stars <owner/repo>

No API key needed (60 req/h unauthenticated; GITHUB_TOKEN raises it to 5000/h). Plain Node >= 18, zero npm dependencies, MIT. It's heuristics over the GitHub API — no LLM, no magic — and when a finding is wrong, that's a bug I want to hear about.

What would you want it to check that it doesn't?
```

## Reply ammunition (expected questions)

- **"Is this just a linter?"** → "A linter checks text. This ranks fixes by recoverable points (pillar weight ÷ checks in pillar), benchmarks you against the whole language ecosystem, and refuses to score on missing data."
- **"How is the percentile computed?"** → "7 star buckets (0 / 1–2 / 3–9 / 10–99 / 100–999 / 1k–10k / 10k+), counted via `search/repositories?q=stars:X language:Y`. You learn the honest range within your bucket, plus context for tiny repos: '90% of peers have 0 stars; median peer: 0'."
- **"Why would a famous repo care?"** → "It's not for famous repos — it's for the repo you pushed last night. We audit got/express in the README as calibration, not as customers."
- **"Privacy?"** → "It's read-only metadata + README parsing, all local. Your token goes to api.github.com only, never logged or stored."
