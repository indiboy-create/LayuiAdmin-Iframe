# 安全策略

## 支持范围

本项目是纯静态的后台模板（基于 Layui 2.13.9 与 MyTSA Admin 模块），发布形式为 `dist/` 静态文件与 npm 包 `@initearth/mytsa-admin-iframe`。

| 版本 | 是否维护 |
| ---- | -------- |
| 1.x  | 是       |

## 报告安全问题

请**不要**在公开 Issue 里披露可被利用的细节。推荐通过仓库的 **Security → Advisories → Report a vulnerability** 私下提交，或在 Issue 中只描述影响面并注明「需要私下沟通」，维护者会建立私密讨论通道。

报告时请尽量附上：

- 受影响的页面或模块（如 `tabPage.js`、`login.html`）
- 复现步骤与浏览器版本
- 影响判断（XSS / 信息泄露 / 拒绝服务等）
- 若已有修复想法，一并说明

我们会先确认问题，再评估影响范围与修复窗口；修复发布后在 CHANGELOG 中注明，并在 Advisory 中公开致谢（如你愿意署名）。

## 部署方需要自行承担的部分

模板本身不包含服务端，以下事项由使用方负责：

- **演示口令**：`src/api/auth.json` 内置 `admin` / `admin123` 仅用于本地演示，鉴权逻辑在前端（`api/auth.json` 同样会被打进 npm 包与发布 zip）。上线前必须替换口令，最好整体替换为真实后端登录；`npm run check:release` 在检测到默认口令时只会给出提示，不阻断构建，请不要忽略。
- **Referrer-Policy**：页面内已用 `<meta name="referrer" content="no-referrer">` 声明策略，生产环境也可改由服务端下发 `Referrer-Policy: no-referrer` 响应头。
- **传输层**：必须通过 HTTPS 部署，避免口令与业务数据在链路上明文传输。
- **访问控制**：静态模板无法阻止直接访问子页地址；`index.html` 之外的页面应通过服务端鉴权或网关策略保护，不要仅依赖前端跳转。

## 已内置的防护

- 标签页标题、菜单标题、iframe 地址统一走 `sanitize.js` 的 `escapeHtml` / `safeUrl` / `safeHref`，拒绝 `javascript:` 等伪协议。
- 页面不包含内联脚本，脚本统一外置，避免内联事件带来的注入面。
- `_blank` 打开的链接统一带 `rel="noopener noreferrer"`；页面声明 `referrer no-referrer`。
- 存储读写（`sessionStorage` / `localStorage`）全部包了 `try/catch`，存储不可用时降级而非抛错中断。
- CI 执行 `npm audit --audit-level=high`，并对产物做必要文件、体积与断链校验。
