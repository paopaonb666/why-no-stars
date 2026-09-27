# 发布文案包 — 登录后 30 分钟内全部发完

每个平台的文案都已写成成品：打开对应文件，全选复制，粘贴发布。
所有文案遵守 LAUNCH.md 的核心规则：**发"发现"，不发"我做了个工具"**；诚实标注启发式；欢迎挑刺。

## 你的 10 分钟操作清单（按顺序做）

### 0. GitHub 社交预览图（2 分钟，做一次管所有分享）

1. 打开 https://github.com/paopaonb666/why-no-stars/settings
2. 拉到 **Social preview** → **Edit** → **Upload a new image**
3. 选仓库里的 `examples/self-scorecard.png`（1200×630，专为 OG 图设计）
4. 保存。以后每条推文、每个分享卡片都会显示这张评分卡

> 需要登录 GitHub；本仓库无登录会话，此步必须本人完成。

### 1. npm 发布（2 分钟，解锁 `npx why-no-stars` 一行命令）

```bash
npm login        # 浏览器会弹出授权页
npm publish      # prepublishOnly 会先跑 32 项测试
```

发布后：把两个 README 和 `--help` 里的 `npx github:paopaonb666/why-no-stars` 主示例替换为 `npx why-no-stars`，然后 `npm version patch` 发 1.1.1（这本身就是一条"我们到了 npm"的更新素材）。

### 2. V2EX 分享创造（3 分钟）→ [v2ex.md](./v2ex.md)

登录 https://v2ex.com/signin → https://www.v2ex.com/new → 节点选「分享创造」→ 粘贴标题和正文 → 发布。**发出后 1 小时内回复每条评论。**

### 3. Show HN（5 分钟，注意黄金窗口）→ [show-hn.md](./show-hn.md)

登录 https://news.ycombinator.com/login → https://news.ycombinator.com/submit
**黄金窗口：美东 8–10 AM = 北京时间 20:00–22:00**。贴标题 + 仓库 URL，**立刻**用文件里的首评跟帖，然后守 2 小时回复。

### 4. 掘金文章（5 分钟，随时可发）→ [juejin.md](./juejin.md)

登录 https://juejin.cn → 进入创作中心新建文章 → 粘贴 → 封面图选 `examples/self-scorecard.png` → 标签加 `GitHub`/`开源`/`工具` → 发布。

### 5. Reddit（4 分钟，两个子版错开 24h）→ [reddit.md](./reddit.md)

先发 r/SideProject，24 小时后发 r/opensource（文案已按两个社区的不同口味写好）。

## 已完成检查（浏览器侦察结论，2026-09-27）

| 平台 | 登录状态 | 结论 |
|---|---|---|
| GitHub（浏览器） | 未登录 | 社交预览需本人上传 |
| npm（CLI + 网页） | 未登录 | 需本人 `npm login` |
| V2EX | 未登录（Cloudflare 通过） | 需本人登录后发帖 |
| Hacker News | 未登录 | 需本人登录后发帖 |
| 掘金 | 未登录 | 需本人登录后发帖 |

所有平台账号凭据属于你本人——代理不代登录、不代输密码。
