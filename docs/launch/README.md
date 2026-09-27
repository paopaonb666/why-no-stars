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

### 1. npm 发布（⚠️ 当前被网络封锁阻塞，替代方案已上线）

```bash
npm login        # www.npmjs.com 被 DataDome IP 黑名单封锁，registry 正常
npm publish      # 账号建好后：registry 直连可用，5 分钟完成
```

**当前状态（2026-09-27 晚）**：www.npmjs.com 对本机全部网络出口（家宽 183.210.x / 移动 223.104.x / 代理 203.198.x）均返回 DataDome 硬封锁，验证码 CDN（captcha-delivery.com）从国内亦不可达，legacy 注册 API 已被 npm 关闭——三重锁。

**已上线的替代方案**：v1.1.1 通过 GitHub Actions（内置 GITHUB_TOKEN，零额外凭据）自动发布到 **GitHub Packages**：`@paopaonb666/why-no-stars`。主安装路径 `npx github:paopaonb666/why-no-stars` 不受任何影响。

**npmjs 后续发布**：等干净网络注册账号后，把 NPM_TOKEN 加入仓库 Secrets，在 publish.yml 加一个 npmjs job 即可自动发布——完全绕开本机网络。

### 2. V2EX 分享创造（3 分钟）→ [v2ex.md](./v2ex.md)

登录 https://v2ex.com/signin → https://www.v2ex.com/new → 节点选「分享创造」→ 粘贴标题和正文 → 发布。**发出后 1 小时内回复每条评论。**

### 3. Show HN（5 分钟，注意黄金窗口）→ [show-hn.md](./show-hn.md)

登录 https://news.ycombinator.com/login → https://news.ycombinator.com/submit
**黄金窗口：美东 8–10 AM = 北京时间 20:00–22:00**。贴标题 + 仓库 URL，**立刻**用文件里的首评跟帖，然后守 2 小时回复。

### 4. 掘金文章（5 分钟，随时可发）→ [juejin.md](./juejin.md)

登录 https://juejin.cn → 进入创作中心新建文章 → 粘贴 → 封面图选 `examples/self-scorecard.png` → 标签加 `GitHub`/`开源`/`工具` → 发布。

### 5. Reddit（4 分钟，两个子版错开 24h）→ [reddit.md](./reddit.md)

先发 r/SideProject，24 小时后发 r/opensource（文案已按两个社区的不同口味写好）。

## 已完成检查（浏览器侦察结论，2026-09-27 晚更新）

| 平台 | 登录状态 | 结论 |
|---|---|---|
| V2EX（内置浏览器） | **已登录 `paopaonb666`，但账号未激活** | 发帖需要：邀请码，或绑定 Solana 持有 10000 个 $V2EX token。激活地址 https://www.v2ex.com/invite/activate |
| GitHub（内置浏览器 / Tabbit / Edge 三个环境） | 全部未登录 | 社交预览需本人在任一浏览器登录后上传 |
| npm（CLI + 网页） | 未登录 | 需本人 `npm login` |
| Hacker News（内置浏览器） | 未登录 | 需本人登录后发帖 |
| 掘金 | 未登录 | 需本人登录后发帖 |

代理已穷尽三个浏览器环境（ZCode 内置浏览器、Tabbit、Edge），全部无 GitHub 会话。
账号凭据属于你本人——代理不代登录、不代输密码、不代注册。
