// Pillar 2: Time-to-hello-world — friction between "interested" and "running it".
import { check } from './helpers.js';

export function quickstartChecks(f) {
  const out = [];
  const readme = f.readme;

  // When the README fetch was refused, "no README" would fabricate absence.
  const NO_README = f.readmeState === 'unknown'
    ? { en: 'README unavailable this run (API refused) — not counted against you.', zh: '本轮 README 不可用（API 拒绝）——不计入评分。' }
    : null;

  out.push(
    check('install-oneliner', 'quickstart', { en: 'Copy-paste install command', zh: '可复制的安装命令' }, {
      status: readme === null ? 'skip' : readme.installLine ? 'pass' : 'fail',
      detail: readme === null
        ? (NO_README ?? { en: 'No README to inspect — covered by the README check.', zh: '没有 README 可检查——已由「README 存在」检查覆盖。' })
        : readme.installLine
          ? { en: `Found at README line ${readme.installLine}`, zh: `在 README 第 ${readme.installLine} 行找到` }
          : { en: 'No npm/pip/cargo/brew/docker style install command found in the README.', zh: 'README 中没有找到 npm/pip/cargo/brew/docker 风格的安装命令。' },
      fix: {
        en: 'Add an obvious one-liner: `npm i your-pkg` / `pip install your-pkg` / `cargo add ...`. This single line is the #1 conversion lever.',
        zh: '加一条显眼的一行命令：`npm i 包名` / `pip install 包名` / `cargo add ...`。这一行是转化率的第一杠杆。',
      },
      impact: 'high',
    })
  );

  const firstCode = readme?.codeBlocks?.length ? readme.codeBlocks[0].start : null;
  out.push(
    check('quickstart-code', 'quickstart', { en: 'Quickstart code block', zh: '快速上手代码块' }, {
      status: readme === null ? 'skip' : firstCode === null ? 'fail' : firstCode <= 120 ? 'pass' : 'warn',
      detail: readme === null
        ? (NO_README ?? { en: 'No README to inspect — covered by the README check.', zh: '没有 README 可检查——已由「README 存在」检查覆盖。' })
        : firstCode
          ? { en: `First code block at line ${firstCode}`, zh: `第一个代码块在第 ${firstCode} 行` }
          : { en: 'No fenced code block in the README.', zh: 'README 里没有围栏代码块。' },
      fix: {
        en: 'Add a “Quick start” section with a runnable snippet near the top — show the happy path in < 10 lines.',
        zh: '在靠前位置加一个「快速开始」小节，放一段能跑的最小示例——10 行以内展示 happy path。',
      },
      impact: 'high',
    })
  );

  const exampleDir = f.rootFiles.find((x) =>
    /^(examples?|demos?|playground|docs?|documentation)$/i.test(x.name) && x.type === 'dir'
  );
  const contentsUnknown = f.contentsKnown === false;
  out.push(
    check('examples-dir', 'quickstart', { en: 'Examples / docs directory', zh: '示例 / 文档目录' }, {
      status: contentsUnknown ? 'skip' : exampleDir ? 'pass' : 'warn',
      detail: contentsUnknown
        ? { en: 'Root file list unavailable (API refused) — not counted against you.', zh: '根目录文件列表不可用（API 拒绝）——不计入评分。' }
        : exampleDir
          ? { en: `Found ./${exampleDir.name}/`, zh: `找到 ./${exampleDir.name}/ 目录` }
          : { en: 'No examples/, demo/ or docs/ directory at the repo root.', zh: '仓库根目录没有 examples/、demo/ 或 docs/ 目录。' },
      fix: {
        en: 'Add an examples/ folder with 1–3 minimal runnable cases. Browsers of code trust examples.',
        zh: '加一个 examples/ 目录，放 1–3 个最小可运行示例。看代码的人最信示例。',
      },
      impact: 'medium',
    })
  );

  out.push(
    check('manifest', 'quickstart', { en: 'Package manifest at root', zh: '根目录有包管理清单' }, {
      status: contentsUnknown ? 'skip' : f.hasManifest ? 'pass' : 'warn',
      detail: contentsUnknown
        ? { en: 'Root file list unavailable (API refused) — not counted against you.', zh: '根目录文件列表不可用（API 拒绝）——不计入评分。' }
        : f.hasManifest
          ? { en: 'Found a package manifest (package.json, pyproject.toml, Cargo.toml, …).', zh: '找到包管理清单（package.json、pyproject.toml、Cargo.toml 等）。' }
          : { en: 'No recognized package manifest at the repo root.', zh: '仓库根目录没有可识别的包管理清单。' },
      fix: {
        en: 'Keep the ecosystem manifest (package.json / pyproject.toml / Cargo.toml / go.mod) at the repo root so tools and humans recognize the stack instantly.',
        zh: '把生态清单（package.json / pyproject.toml / Cargo.toml / go.mod）放在仓库根目录，让人和工具一眼认出技术栈。',
      },
      impact: 'medium',
    })
  );

  // \b guards keep "Docker deployment" / "Docusaurus" from matching "doc".
  const docsHeading = readme?.headings?.some((h) => /\b(docs?|documentation|guide)\b|文档|指南/i.test(h.text));
  out.push(
    check('docs-link', 'quickstart', { en: 'Docs / guide pointer', zh: '文档 / 指南入口' }, {
      status: f.homepage || docsHeading ? 'pass' : 'warn',
      detail: f.homepage
        ? { en: `Homepage: ${f.homepage}`, zh: `主页：${f.homepage}` }
        : docsHeading
          ? { en: 'README has a docs/guide section.', zh: 'README 中有文档/指南小节。' }
          : { en: 'No docs site link or guide section found.', zh: '没有找到文档站链接或指南小节。' },
      fix: {
        en: 'Link fuller docs (wiki, docs site, or ./docs) from the top of the README.',
        zh: '在 README 顶部链接到更完整的文档（wiki、文档站或 ./docs）。',
      },
      impact: 'low',
    })
  );

  return out;
}
