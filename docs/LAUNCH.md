# Launch playbook — how this repo gets to 1,000 stars

A star is a conversion event. This document is the plan for earning 1,000 of them.
It is written for the maintainer (you). Nothing here is automated — distribution is a human sport.

## Phase 0 — ship hygiene (done before launch)

- [x] Zero-dependency, one-command run (`npx github:paopaonb666/why-no-stars owner/repo`)
- [x] Hero SVG scorecard in README (also upload as **social preview**: Settings → General → Social preview, use `examples/got-scorecard.png`)
- [x] Bilingual README (EN + zh-CN) — CN dev communities are a first-week force multiplier
- [x] CI green, LICENSE, CONTRIBUTING
- [ ] `npm login && npm publish` — **this is the big one.** After publishing, the one-liner shortens to `npx why-no-stars owner/repo`, which is what people paste into their terminals. Unpublished, every npx hit compiles from git and feels slower.

## Phase 1 — the self-audit (day 0)

Run the tool on itself and pin the result. The repo audits its own README in the top comment of the launch posts. If a repo about first-10-seconds can't ace its own first 10 seconds, nothing else below matters.

```bash
node bin.js paopaonb666/why-no-stars --svg examples/self-scorecard.svg --md docs/self-report.md
```

## Phase 2 — launch day (pick one day, do all of it)

> **Ready-to-paste copy for every platform is in [docs/launch/](./launch/README.md) — titles, first comments, and per-platform checklists. Publish order and timing included.**

Order matters: developer audiences first (forgiving, will file bug reports), general audiences later.

| Channel | Angle | Note |
|---|---|---|
| Show HN | "Show HN: Why-no-stars – Find out why your repo isn't getting stars" | Post 8–10 AM ET. Lead with the got/express audit: "even 15k-star repos fail 3 checks". Reply to every comment for 24h. |
| Reddit r/SideProject + r/opensource | Story angle: "I audited 50 neglected repos with my CLI. The same 3 fixes came up every time." | The aggregate finding IS the content. Include the scorecards. |
| V2EX 分享创造节点 | 中文帖：用中文 README 的截图，标题《我写了个工具，诊断你的 GitHub 仓库为什么没人 star》 | 中文社区是第一波 star 主力。诚实标注"启发式规则，不是 AI"。 |
| 掘金 / 知乎 | 教程 angle：「你的 README 的前 10 秒：32 项检查里暴露的问题」 | 把 Top fixes 当内容写，工具是文末的 CTA。 |
| X/Twitter | Thread: 3 famous repos audited, 3 real findings each | Every tweet gets one scorecard image. OG-size is designed for this. |
| 即刻 / 微信开发者群 | 一句话 + 评分卡图 | Groups reward工具+图, punish links alone. |

**The launch-post rule:** never post "I made a tool". Post *a finding*. "The median repo buries its install command below line 150" is content; "try my CLI" is spam.

## Phase 3 — the viral loop (built into the product)

The shareable SVG scorecard carries `npx why-no-stars <owner/repo>` in its footer. Every user who posts their scorecard markets the tool. Accelerate it:

1. **Badge in the Markdown report** — the `--md` output ends with a link. Users paste reports into their READMEs/issues → each paste is a backlink.
2. **Reply to every scorecard shared on X/V2EX with one concrete extra tip.** Being the doctor who follows up beats being the tool that scores.
3. **Weekly ritual:** audit one well-known repo, post the scorecard. Famous repos get clicks; the findings get shares.

## Phase 4 — compounding (weeks 2–8)

- **npm publish** → the npx path becomes frictionless → word-of-mouth loop closes.
- Ship the roadmap items users ask for loudest (`--local` mode first — it removes the rate-limit objection entirely).
- "awesome" lists: submit to awesome-github, awesome-cli lists once >200 stars.
- GitHub Topics: the repo's own topics (cli, github, readme, audit…) do passive discovery work.
- Every issue = a chance for a faster first-response time than 99% of repos. Community health is checked by tools like this one; practice what we measure.

## The math, honestly

1,000 stars at a typical launch funnel (10–15% of launch-audience impressions convert to a repo visit, 2–5% of visits star when the first 10 seconds work):

- One good Show HN front-page day: 3–8k visits → 80–250 stars
- CN communities combined: 300–800 stars over week 1
- X thread + Reddit: 100–300
- Long tail via the scorecard viral loop + npm search: 50–150/month after

That's the 1,000. It depends on the launch posts being *content*, the README converting, and replying to everyone. The tool can't do this part — that's why this file exists.

## What NOT to do

- No star-for-star exchanges, no buying stars, no bot stars. They're detectable, they're against GitHub ToS, and this tool itself was built on the thesis that organic signals are the ones that matter.
- Don't spam unrelated repos' issues with scorecards. Offer the audit, don't impose it.
