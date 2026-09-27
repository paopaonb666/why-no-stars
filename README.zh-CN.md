<div align="center">

# 🔍 why-no-stars

**用证据回答：你的 GitHub 仓库为什么没人 star。**

六大支柱 32 项检查 · 同语言生态 star 分位对比 · 一张可分享的评分卡。
零依赖、零配置、无需 API key。

[![CI](https://github.com/paopaonb666/why-no-stars/actions/workflows/ci.yml/badge.svg)](https://github.com/paopaonb666/why-no-stars/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](./package.json)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](./package.json)
[![Stars](https://img.shields.io/github/stars/paopaonb666/why-no-stars?style=social)](https://github.com/paopaonb666/why-no-stars/stargazers)

<img src="./examples/self-scorecard.svg" alt="why-no-stars 自审计：发布当天 85/100，增长势头诚实地为 0" width="720">

[English](./README.md) · [中文](#中文)

</div>

---

<a name="中文"></a>

## 一句话介绍

你做了一个好东西，能跑、有测试、骄傲地推上 GitHub。然后它只有 **47 个 star**。（其中十四个是你同事点的，我们数过了。）

**你的问题不是没做推广，而是前 10 秒没做好。** 访客点进仓库、扫一眼、决定去留——`why-no-stars` 基于证据推断他们卡在了哪一步：每一条结论都注明出处（第几行、几个、哪天）：

```text
  ⚡ 最值得先做的三件事
  1. [HIGH] 安装命令靠近顶部
     第一条可复制的安装命令在第 62 行
     → 把安装命令提到 README 首屏
  2. [HIGH] 首屏有截图 / GIF / Demo 图
     只有徽章类图片——没有真正的截图 / demo / 主视觉
     → 把截图放到 README 前 ~40 行
  3. [MED] Issue 模板
     没有 issue 模板
     → 加 .github/ISSUE_TEMPLATE
```

你可以不同意诊断，但没法忽视它——因为每一条都亮出了证据。

## 快速开始

```bash
# 免安装（直接从 GitHub 运行）
npx github:paopaonb666/why-no-stars <用户名/仓库>

# 或克隆后运行
git clone https://github.com/paopaonb666/why-no-stars && cd why-no-stars
node bin.js <用户名/仓库>
```

```bash
npx github:paopaonb666/why-no-stars sindresorhus/got                 # 终端评分卡
npx github:paopaonb666/why-no-stars 我的项目 --svg card.svg     # 1200×630 可分享评分卡
npx github:paopaonb666/why-no-stars 我的项目 --md report.md     # 可直接贴到 issue 的报告
npx github:paopaonb666/why-no-stars 我的项目 --zh               # 中文输出（中文环境自动生效）
```

> **无需 API key 也能跑。** 无 token 的 GitHub 限额是 60 次/小时（约 4 次体检）。
> 配置 `GITHUB_TOKEN` 后提升到 5000 次/小时。私有仓库加 token 同样可用。

## 六大支柱

| 支柱 | 权重 | 回答的问题 |
|---|---|---|
| **第一印象** | 25 | 陌生访客在前 10 秒会不会产生兴趣？ |
| **快速上手** | 20 | 从"有点兴趣"到"跑起来"要几步？ |
| **信任与维护** | 20 | 这项目能放心用吗，还是数字废墟？ |
| **社区健康** | 15 | 最早的外部贡献者想参与时，有没有现成的入口？ |
| **可发现性** | 10 | 搜相关关键词的人真的能搜到它吗？ |
| **增长势头** | 10 | 最近还有新东西进来吗，还是完全静止？ |

六大支柱共 **32 项检查**，每项都有：状态、证据、具体修复动作。同一支柱内每项检查权重相等，所以单条修复能让总分变动 2.5–5 分——足以跨一个评级。

**它不衡量什么：代码质量。** 这个工具衡量的是仓库向首次访客呈现自己的水平——README、信任信号、入口是否齐全。一个绝妙的仓库可能得 C，一个平庸的仓库可能得 A。这正是设计意图：分数是你"店面"的待办清单，不是对你工程水平的审判。

每项检查的源码只有 ~30 行——[自己看](./src/checks)。

## 别处没有的指标：你的生态分位

对着抽象的最佳实践打分谁都会。`why-no-stars` 还会告诉你：**在你的语言的全部仓库里，你排在什么位置。** 它通过 GitHub 搜索 API 统计同主语言所有仓库的 star 分布（0、1–2、3–9、10–99、100–999、1k–10k、10k+ 七个桶），然后给出一个诚实的**区间**：

```text
expressjs/express: 93/100 (S) · star 数超过同类仓库的 99–100%
我的项目:       38/100 (F) · star 数超过同类仓库的 30–45%
```

只给区间不装精确——因为我们只知道你落在哪个桶里，不会编造精度。对 star 很少的仓库区间会变宽，所以我们补上真正重要的背景：`90% 的同类仓库为 0 star，中位数仓库：0`。

## 证明它不谄媚名人仓库

我们体检了 [`sindresorhus/got`](https://github.com/sindresorhus/got)——GitHub 上打磨最精致的仓库之一——它照样带回具体发现：

```text
  总分  93/100  [S]          生态分位：star 数超过同类仓库的 99–100%（TypeScript）

  第一印象     ████████░░   81  (w 25 · 8 项)
  快速上手     ██████████  100  (w 20 · 5 项)
  ...

  ⚡ 最值得先做的三件事
  1. [MED] 主页链接
     About 侧边栏没有设置主页链接
  2. [HIGH] 安装命令靠近顶部
     第一条可复制的安装命令在第 71 行
```

连 S 级仓库都能拿到可执行的改进项。完整报告见 [`examples/got-report.md`](./examples/got-report.md)。

## 我们给自己也做体检

言行一致不是口号。上面的主图就是 `why-no-stars` 体检**它自己**的真实报告（发布几分钟后跑的）。三大支柱在 90–100；扣掉的分都是我们待办清单上的真问题（下一个是主页链接）。增长势头是 0，因为今天刚发布——工具拒绝装糊涂。唯一一个我们自己修不了的支柱，就握在你手里。 😉

<details>
<summary><strong>全部参数与输出格式</strong></summary>

```bash
npx github:paopaonb666/why-no-stars 用户名/仓库 --svg scorecard.svg --json report.json --md report.md --zh
```

| 参数 | 作用 |
|---|---|
| `--svg <file>` | 1200×630 可分享评分卡（OG 图尺寸，适合贴进 README 和社交平台） |
| `--json <file>` | 机器可读报告（CI、看板） |
| `--md <file>` | Markdown 报告，可直接贴进 issue / discussion |
| `--zh` / `--en` | 输出语言（默认按 LANG 环境变量自动检测） |
| `--no-benchmark` | 跳过生态分位（省 7 次 API 调用） |
| `--token <t>` | GitHub token（默认读 `GITHUB_TOKEN` / `GH_TOKEN`） |
| `--quiet` | 只输出一行：分数 + 评级 + 分位 |

退出码：`0` 正常 · `1` 出错（仓库不存在、参数错误等）· `2` 被限流。

</details>

## FAQ

**这不就是个 README linter 吗？**
不是。linter 检查文本；`why-no-stars` 诊断的是**转化率**：它把你和整个语言生态做分位对比、按"每条修复能找回多少分"排序、每个结论都带证据。

**会伤到我的感情吗？**
可能会，评级最低到 **F**。建议的循环是：跑一次 → 修前三项 → 再跑一次。分数是镜子，不是判决。

**私有仓库？** 传个 token 就行，私有仓库照常体检。

**它会出错吗？** 会——它只是 GitHub API 之上的启发式规则，没有 LLM、没有魔法。它也拒绝编造：当 API 拿不到数据（超大仓库的贡献者列表），检查项会标记为「跳过」，绝不计零分。错了就是 bug，欢迎[提 issue](https://github.com/paopaonb666/why-no-stars/issues)。

## 已知局限

- 全部发现都是启发式（正则 + API 元数据），完全离线、确定性运行，不会上传任何代码。
- 生态分位对比的是同主语言的 star 数量，暂未按仓库年龄归一化（在路线图上）。
- 超大仓库（>约 4 万 star）的"近期 star"数据来自公开事件流的采样下限，因为 GitHub 限制了 stargazers 深分页。
- 没有包管理清单的项目（内核、原生代码）在生态特定检查上会得到更温和的判定——工具会在输出中说明，而不是瞎猜。

## 路线图

- [ ] `wns --local .` — 不走 API，直接体检本地目录
- [ ] 按年龄归一化的分位（与同期的仓库对比）
- [ ] `--watch` 模式：定时复查，追踪各支柱分数变化
- [ ] GitHub Action：README 变更时自动体检并评论
- [ ] 分支柱分位对比（与体量相近的同语言仓库样本）

## 参与贡献

Issue 和 PR 都欢迎，见 [CONTRIBUTING.md](./CONTRIBUTING.md)。加一个新检查只要 ~30 行：一个接收 facts 返回 `{ status, detail, fix, impact }` 的函数。[检查项注册表](./src/checks)刻意写得非常朴素。

## License

[MIT](./LICENSE) © 2026 paopaonb666

---

<div align="center">

**star 不是玄学，是前 10 秒的功夫。**

如果这个工具帮你的仓库找到了问题，就点个 star——你现在最清楚一颗 star 的价值了。 😉

</div>
