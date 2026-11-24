# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Changed

- iframe 子页面（`home.html`、`workbench.html`、`table.html`、`layui.html`）移入 `src/iframe/`；菜单、默认标签、用户菜单、工作台快捷入口与构建检查路径同步更新。
- `src/admin/` 下的配置、样式、图片与脚本移入 `src/theme/`；页面引用、构建流程、测试与文档路径同步更新。
- `mytsa.config.json` 从 `src/theme/config/` 移入 `src/api/`；运行时配置读取、构建打戳、校验脚本与文档路径同步更新。
- 主题资源 `css/`、`images/`、`js/` 移入 `src/theme/admin/`；页面引用、构建脚本、校验与文档路径同步更新。
- 登录页与后台入口资源隔离：登录样式/图片放在 `src/theme/login/`，登录跳转逻辑内联到 `login.html`；除 `component/layui/` 外不再共用资源。
- iframe 子页面移入 `src/theme/iframe/` 并完成资源隔离：样式、脚本与配置独立到该目录，除 `component/layui/` 外不再引用后台/登录资源；E2E 增加隔离断言。
- 登录页移除 `theme-color` 声明，仅保留 `color-scheme: light`；后台与 iframe 页面仍同步主题色。
- `component/login/css/variables.css` 删除，登录主色直接写成 `#16baaa`，登录页减少一个样式请求和一个根变量。
- 登录提交改为直接跳转 `index.html`；前端不再校验账号或写入登录会话，账号权限与访问控制由后端服务或网关负责。
- 登录表单不再接管回车提交，仅点击登录按钮触发跳转。
- `login.css` 移到 `theme/login/css/`，登录跳转逻辑直接写入 `login.html`；删除 `component/login/` 目录及相关校验。

### Removed

- 移除页面 CSP `<meta>` 声明、`admin/js/csp-guard.js` 及其引用，并同步移除构建检查与端到端冒烟中的 CSP 断言；保留 `referrer no-referrer` 与外置脚本约定。
- 移除整套 debug 功能：`debug.js`、`adminDebug`、URL/存储/配置开关、`strip-debug`/`config` 构建步骤、`dist-debug` 与 `build:debug`/`check:debug`/`check:release` 命令及相关 CI/文档；发布产物只保留压缩版 `dist/`。
- 移除登录页 iframe 跳出模块 `loginGuard.js`；防嵌入应改由服务端响应头处理。
- 删除 `src/api/auth.json` 及默认口令检测/提醒。
- 删除后台 `theme/admin/js/auth.js` 与 `data-guard` / `data-guard-login` 前端守卫；注销按钮仅跳回 `login.html`。

## [1.0.1] - 2026-11-24

### Added

- `SECURITY.md`：说明漏洞报告渠道、部署方责任边界与已内置的防护。
- `.github/PULL_REQUEST_TEMPLATE.md`：统一 PR 的改动说明、自检清单与回滚说明。
- README「部署与缓存」章节：静态托管的不可变缓存（`immutable`）与压缩配置示例。
- `npm run check` 按类型校验产物体积：HTML ≤ 8 KB、项目脚本 ≤ 20 KB、项目 CSS ≤ 16 KB、图片 ≤ 40 KB、JSON ≤ 12 KB，另保留单文件 500 KB 兜底上限（`component/layui/` 不参与，类型预算仅对压缩产物生效）。
- 全部 7 个页面补齐 CSP 与 `referrer no-referrer`；`javascript:` 链接兜底逻辑抽成共享脚本 `admin/js/csp-guard.js`，子页被直接打开时同样受策略保护。
- 新增 `npm run check:package`：校验 npm 包名、版本、必需文件、禁止混入 `dist-debug/src/test` 与包体上限；CI 在 Node 24 任务中执行。
- CI 新增 `npm run format:check`，并补充 `.gitattributes` 统一 LF，减少 Windows 下的换行噪声。

### Changed

- 缓存标记由“每次构建统一时间戳”改为“按最终产物内容计算 SHA-256 前 10 位”：HTML/CSS/JS/图片各自带自己的哈希，未变化的 `layui.js`、`layui.css` 可继续命中缓存；`mytsa.js` 的 layui 模块版本改用 `component/mytsa` 全部 JS 的模块指纹，构建结果可复现。
- `bundleMytsaCss` 合并后删除无人引用的 `module/menu.css`、`module/tabPage.css`；`mytsa.css` 因登录页与子页仍在引用而保留。
- Husky `pre-commit` 与 `commit-msg` 改为用 `node` 直调 lint-staged / commitlint，lint-staged 任务也使用显式 `node` 入口，避免 Git Bash 找不到 `npx` 或本地 `bin` 时钩子失效。
- Release 工作流增加 `id-token: write` 与 `npm publish --provenance`，并按 job 收敛权限；npm 公共源发布仍需具备 `@initearth` scope 权限的 `NPM_TOKEN`。
- Pages 部署改为由 `main` 分支或手动触发，避免标签触发被 `github-pages` 环境的部署分支保护拦截；Pages 相关动作同步升级到当前主版本。
- 演示 logo 由 PNG 改为 WebP（13.9 KB → 5.5 KB），登录页与后台侧栏同步更新；两处 logo 补 `width`/`height` 与 `decoding="async"`，避免图片加载造成的布局抖动。
- 登录页移除未使用的 `component/mytsa/mytsa.js`（登录只依赖 `form`、`layer`），少一次请求与模块映射初始化。
- 主题切换时同步 `<meta name="theme-color">`，移动端状态栏颜色跟随当前配色方案。
- 水印改由父框架统一绘制（`admin/js/watermark.js`，原 `message.js` 更名），覆盖所有标签与 iframe；子页仅在直接打开时绘制，嵌入时自动跳过，避免双层水印。
- 新增 `@media print` 打印样式：隐藏顶栏/侧栏/标签栏/水印/遮罩/loading，内容区全宽白底。
- npm 包名迁移为 `@initearth/mytsa-admin-iframe`；Release 仅在仓库归属 `initearth` 时发 GitHub Packages，否则只发 npm 公共源（需配置具备 `@initearth` scope 权限的 `NPM_TOKEN`）。
- Release 资产与工作流产物统一命名为 `mytsa-admin-iframe-<tag>.zip`、`mytsa-admin-iframe-<tag>-debug.zip`。
- 仓库地址迁移至 `https://github.com/initearth/mytsa-admin-iframe`，在线预览迁移至 `https://initearth.github.io/mytsa-admin-iframe/`；`package.json` 与 `mytsa.config.json` 中的仓库/预览链接同步。
- 产品显示名统一为 `MyTSA`：页面标题、登录页、水印、关于页、主题配置、README 与 VS Code 调试配置同步；技术标识保持小写 `mytsa`。

### Fixed

- `tab.session` 恢复标签时未校验 `tab.max`：旧版本（上限曾为 30）留下的会话会把超限标签整批恢复。现在恢复时按当前上限截断并回写存储，当前标签被截掉时回落到第一个标签。

## [1.0.0]

首个公开发布版本，主要内容：

- Layui 2.13.9 + MyTSA Admin 模块的 iframe 版后台模板，静态拷贝构建（`scripts/build.mjs`），不改动 `src/component/layui/`。
- 标签页按需创建、`tab.max` 限制、`tab.session` 刷新恢复；菜单与标签补齐 ARIA 与键盘操作（含 roving tabindex、`Delete` 关闭、跳过链接）。
- 安全基线：无内联脚本 + CSP（`script-src 'self'`）、`referrer no-referrer`、`sanitize.js` 统一转义与伪协议拦截、`_blank` 补 `noopener noreferrer`、演示鉴权 `auth.js` + `api/auth.json`。
- 稳定性：配置/菜单加载失败不再永久卡 loading（超时与 `try/finally` 兜底）、iframe 加载失败覆盖层、构建产物原子替换与失败回滚。
- 工程化：ESLint + Prettier + Node 内置测试（26 项）+ 端到端冒烟（50 项）+ `check:release`/`check:debug` 产物校验、Node 20/22/24 CI 矩阵、Dependabot 与 `npm audit`、双源发布（GitHub Packages + npm）。
- 产物优化：CSS 合并（`mytsa.bundle.css` / `admin.bundle.css`）、HTML 压缩、构建戳 `?t=` 缓存刷新、`404.html` 静态兜底页。
