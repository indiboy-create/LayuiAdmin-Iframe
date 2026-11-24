# 更新日志

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- `SECURITY.md`：说明漏洞报告渠道、部署方责任边界与已内置的防护。
- `.github/PULL_REQUEST_TEMPLATE.md`：统一 PR 的改动说明、自检清单与回滚说明。
- README「部署与缓存」章节：静态托管的不可变缓存（`immutable`）与压缩配置示例。
- `npm run check` 按类型校验产物体积：HTML ≤ 8 KB、项目脚本 ≤ 20 KB、项目 CSS ≤ 16 KB、图片 ≤ 40 KB、JSON ≤ 12 KB，另保留单文件 500 KB 兜底上限（`component/layui/` 不参与，类型预算仅对压缩产物生效）。
- 全部 7 个页面补齐 CSP 与 `referrer no-referrer`；`javascript:` 链接兜底逻辑抽成共享脚本 `admin/js/csp-guard.js`，子页被直接打开时同样受策略保护。

### Changed

- 演示 logo 由 PNG 改为 WebP（13.9 KB → 5.5 KB），登录页与后台侧栏同步更新；两处 logo 补 `width`/`height` 与 `decoding="async"`，避免图片加载造成的布局抖动。
- 登录页移除未使用的 `component/mytsa/mytsa.js`（登录只依赖 `form`、`layer`），少一次请求与模块映射初始化。
- 主题切换时同步 `<meta name="theme-color">`，移动端状态栏颜色跟随当前配色方案。
- 水印改由父框架统一绘制（`admin/js/watermark.js`，原 `message.js` 更名），覆盖所有标签与 iframe；子页仅在直接打开时绘制，嵌入时自动跳过，避免双层水印。
- 新增 `@media print` 打印样式：隐藏顶栏/侧栏/标签栏/水印/遮罩/loading，内容区全宽白底。

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
