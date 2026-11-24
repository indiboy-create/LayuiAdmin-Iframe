# MyTSA

MyTSA 是基于 [Layui](https://layui.dev/) 的经典后台管理系统前端模板，技术栈为原生 HTML + CSS + JavaScript，采用 Layui 的 AMD（`layui.define`）模块体系。

**在线预览**：<https://initearth.github.io/mytsa-admin-theme/iframe/>

## 技术栈

- **Layui**：UI 组件与模块加载
- **Vite**：开发服务器（实时刷新）
- **Terser / CleanCSS**：构建时压缩 JS / CSS
- **ESLint / Prettier**：代码规范与格式化
- **Husky + lint-staged + Commitlint**：Git 提交规范

## 目录结构

```
MyTSA
├── src/                    # 源码目录
│   ├── index.html          # 后台主页入口
│   ├── login.html          # 登录页
│   ├── 404.html            # 静态托管错误页
│   ├── iframe/             # iframe 子页面
│   │   ├── home.html       # 首页示例页
│   │   ├── workbench.html  # 工作台示例页
│   │   ├── table.html      # 表格示例页
│   │   └── layui.html      # 消息中心示例页
│   ├── theme/              # 主题资源
│   │   ├── admin/          # 后台入口资源
│   │   │   ├── css/        # 后台样式
│   │   │   ├── images/     # 后台静态图片
│   │   │   └── js/         # 后台引导脚本
│   │   ├── login/          # 登录页静态资源
│   │   │   ├── css/        # 登录样式
│   │   │   └── images/     # 登录页图片
│   │   └── iframe/         # iframe 子页面专属资源
│   │       ├── css/        # iframe 独立样式
│   │       ├── js/         # iframe 独立脚本
│   │       └── config/     # iframe 独立配置

│   ├── api/                # 配置与数据（mytsa.config.json/menu.json）
│   └── component/
│       ├── layui/          # 第三方 Layui 库（构建时不压缩）
│       ├── mytsa/          # MyTSA Admin 模块（admin/menu/tabPage/theme/tools）
│       └── iframe/         # 水印组件（iframe.js 入口 + module/watermark.js）
├── test/
│   ├── smoke.test.mjs      # 冒烟测试（菜单/主题/页面结构）
│   ├── build.test.mjs      # 构建子步骤单测（内容哈希/样式合并/产物替换）
│   └── sanitize.test.mjs   # 转义与地址清洗纯函数单测
├── scripts/
│   ├── build.mjs           # 构建流程编排（临时目录 + 原子替换）
│   ├── check.mjs           # 产物校验脚本
│   └── lib/
│       ├── fs-utils.mjs    # 文件遍历 / 存在性工具
│       ├── validate.mjs    # 引用与配置校验规则
│       └── build/          # 构建子步骤（stamp / bundle-css / minify / replace）
├── .github/workflows/      # CI（ci.yml 复用）+ 部署 / 发布 / 校验工作流
├── vite.config.js          # Vite 开发服务器配置
├── eslint.config.js        # ESLint 配置
├── package.json            # 依赖与脚本
├── LICENSE                 # MIT 许可证
└── .husky/                 # Git 钩子
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 3. 构建到 dist/（静态拷贝 src 并压缩 JS/CSS）
npm run build

# 4. 预览构建产物
npm run preview
```

## 脚本说明

| 命令                    | 说明                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`           | 启动 Vite 开发服务器                                                                   |
| `npm run build`         | 构建压缩产物到 `dist/`                                                                 |
| `npm run preview`       | 本地预览 `dist/`                                                                       |
| `npm run check`         | 校验 `dist/`（入口文件、HTML/CSS 资源引用、JSON 与主题配置、按类型体积预算、缓存标记） |
| `npm run check:package` | 校验 npm 包名、版本、文件清单与包体上限（CI 使用）                                     |
| `npm run e2e`           | 在 `dist/` 上起临时静态服务做 HTTP 链路 E2E（入口页、鉴权/菜单 JSON、静态资源 200）    |
| `npm run test`          | 运行冒烟测试（菜单/主题/页面结构）                                                     |
| `npm run lint`          | ESLint 检查                                                                            |
| `npm run lint:fix`      | ESLint 检查并自动修复                                                                  |
| `npm run format`        | Prettier 格式化 `src`、`scripts`、`test`、根配置、工作流与项目文档                     |
| `npm run format:check`  | Prettier 只检查不写入（CI 使用）                                                       |

## 安装

首个 Release 发布后可从 npm 公共源安装；当仓库归属 `initearth` 组织时，Release 工作流也会同步发布到 GitHub Packages。若尚未发布（`npm view` 返回 404），可直接使用仓库源码构建，或下载 GitHub Release 中的 zip。

```bash
# 公共源（无需额外配置）
npm install @initearth/mytsa-admin-iframe
```

私有仓库或内网场景使用 GitHub Packages（见下节）。

## 从 GitHub Packages 安装（备用）

仅当仓库归属 `initearth` 组织时，GitHub Packages 上才会有同名包；否则请直接使用上面的 npm 公共源。

```bash
# 1. 配置 GitHub Packages registry（写入用户级或项目级 .npmrc）
echo "@initearth:registry=https://npm.pkg.github.com" >> .npmrc

# 2. 使用具备 read:packages 权限的 GitHub Token
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# 3. 安装
npm install @initearth/mytsa-admin-iframe
```

Windows（PowerShell）：

```powershell
Add-Content .npmrc '@initearth:registry=https://npm.pkg.github.com'
Add-Content .npmrc "//npm.pkg.github.com/:_authToken=$env:GITHUB_TOKEN"
npm install @initearth/mytsa-admin-iframe
```

包内容为 `dist/` 下的静态资源，解压后即可作为站点部署。

## 配色方案

`mytsa.config.json` 的 `theme.schemes` 只需声明基色，其余字段由 `theme.js` 派生：

- `base`：侧栏基色（缺省 `#20222A`），同时作为 LOGO 底色
- `header`：顶栏底色（缺省 `#FFFFFF`）
- `logo`：LOGO 底色，缺省与 `base` 相同；需要独立品牌色时显式覆盖

旧格式的 `side` 仍然兼容，与 `base` 等价。

## 登录与鉴权

登录页只做界面与跳转：提交表单后直接进入 `index.html`，不再进行账号校验，也不写入登录会话；账号权限与访问拦截由后端服务或网关负责，注销按钮仅跳回 `login.html`。登录页与后台入口除 `component/layui/` 外不共用资源：登录样式与图片放在 `theme/login/`，登录跳转逻辑直接写在 `login.html`；后台入口使用 `theme/admin/` 与 `component/mytsa/`。iframe 子页面同样独立：除 `component/layui/` 与独立的 `component/iframe` 水印组件入口外，只使用 `theme/iframe/` 内的样式与脚本。

前端不保存任何登录凭据或会话；`sessionStorage` / `localStorage` 仅用于恢复标签页，与账号权限无关。

这条链路只用于拦住误入和直接输入后台地址的访问，不能阻止用户读取该 JSON、改写本地存储，也无法保护被直接打开的 iframe 子页面。需要真实防护时，应由后端签发凭证并在服务端拦截入口页。

## Referrer-Policy

全部 7 个页面（`index`、`login`、`home`、`workbench`、`table`、`layui`、`404`）都声明了 `referrer no-referrer`，避免跳转时泄露来源地址。`index.html` 不包含内联脚本，引导逻辑外置到 `theme/admin/js/bootstrap.js`；`login.html` 的登录跳转逻辑按需求内联，页面不再包含前端鉴权守卫，访问控制应交给后端或网关。

```html
<meta name="referrer" content="no-referrer" />
```

`npm run check` 与 `npm run e2e` 会逐页校验 `referrer no-referrer`，并保持 `index.html` 与 iframe 子页面无内联脚本；`login.html` 按需求保留内联登录跳转。生产环境也可改由服务端下发 `Referrer-Policy: no-referrer` 响应头。

`404.html` 为静态托管兜底页（`noindex`、无外部依赖），Pages / OSS / Nginx 均可在自定义错误页中指向它；除登录页外，页面统一声明了 `theme-color`（默认 `#20222A`）与 `color-scheme: light`，切换配色方案时 `theme.js` 会把 `theme-color` 同步为该方案的侧栏色，移动端状态栏不会与页面脱节；登录页只声明 `color-scheme: light`。

## 标签页与懒加载

标签页按需创建：只有点击菜单时才会为该页面创建 iframe，首屏仅加载 `tab.index` 指定的首页，不会一次性建出所有页面的 iframe。

`tab.max` 控制同时打开的标签页上限，默认 10；达到上限后继续打开会提示“最多打开 10 个标签页”。`tab.session` 为 `true` 时刷新会恢复已打开的标签；恢复同样受 `tab.max` 约束，超出上限的历史标签会被截断并回写存储（当前标签被截掉时回落到第一个）。

## 首屏加载

`other.keepLoad` 是首屏 loading 的最长等待时间（毫秒）。菜单与当前标签的 iframe 都就绪后立即隐藏 loading；超过该时间仍未就绪则强制隐藏，避免弱网白屏。配置或菜单加载失败时会结束 loading 并弹出/展示可重试的提示，不会停在首屏动画。

## 可访问性与水印

- 水印参数通过 `layui.use(['watermark'], function () { var watermark = layui.watermark; watermark.render({...}); })` 回调配置；模块暴露 `defaults` 供查阅，支持 `text`（`MyTSA`）、`fontSize`（13）、`fontFamily`（`'Microsoft YaHei', 'PingFang SC', sans-serif`）、`color`（`#cccccc`）、`opacity`（0.2）、`tileWidth`（220）、`tileHeight`（140）、`offsetX`（30）、`offsetY`（98）、`rotate`（-18°）、`zIndex`（10），四个 iframe 页面均显式传入全部参数，不再读取 JSON 配置。
- `target` 指定水印覆盖的容器（CSS 选择器或 DOM 元素），默认 `null` 表示铺满整个视口（`position: fixed`）；传入元素（如 `#app`）时水印层注入该容器内部并改为 `position: absolute` 铺满容器，容器为 `static` 时模块会自动补 `relative`，不会溢出到页面其他区域。水印层带 `pointer-events: none`，不会拦截鼠标事件，也不会被卡片白色背景遮住。
- 水印已独立为 `component/iframe` 组件：`iframe.js` 入口按 layui 约定注册 `module/watermark.js` 并默认初始化；后台入口同时加载 `mytsa.js` 与 `iframe.js`，iframe 子页面只加载 `iframe.js`。只有在顶层窗口（`window.top === window.self`）才绘制，iframe 嵌入时自动跳过，避免同一屏出现双层水印。
- 标签栏与菜单补齐 ARIA：标签容器 `role="tablist"`、标签项 `role="tab"` + `aria-selected` + `aria-controls`（指向对应 `tabpanel`）、内容面板 `role="tabpanel"` + `aria-labelledby`；菜单 `role="menu"`、可点击项 `role="menuitem"`、含子菜单的项带 `aria-haspopup` 与 `aria-expanded`（展开后自动同步）；每个 iframe 的 `title` 取自对应标签标题。
- 键盘可完整操作：
    - 标签页：焦点进入标签后，`←/→`（或 `↑/↓`）切换相邻标签，`Home`/`End` 跳到首尾，`Delete` 关闭当前标签（首页等不可关闭的标签会忽略），切换后焦点跟随到新标签。
    - 菜单：`↑/↓` 在同级可见菜单项间移动，`→` 展开子菜单，`←` 收起子菜单。
    - 页面顶部提供“跳到主内容”链接，首次按 `Tab` 即可跳到内容区并聚焦。
- 焦点样式统一用 `:focus-visible` 描边（主色 `--global-primary-color`），并尊重 `prefers-reduced-motion`。
- 切换或关闭标签时同步 `document.title`（`<当前标签标题> - MyTSA`），浏览器多开多个后台页面时便于区分。
- 所有页面 HTML 声明 `<meta name="robots" content="noindex,nofollow" />`，产物根目录附带 `robots.txt`（`Disallow: /`），避免演示后台被搜索引擎收录。
- iframe 加载失败时会在该标签内覆盖显示“页面加载失败 + 页面地址 + 重新加载”面板：同源页面返回空内容会立即判定，15 秒内未触发 `load` 也会提示；跨域页面无法读取内容，不做误判。

## 打印

`mytsa.css` 末尾带 `@media print`：打印时隐藏顶栏、侧栏、标签栏、折叠按钮、水印、遮罩与 loading，内容区改为全宽、去掉阴影，并统一白底。父框架打印时会把当前标签的 iframe 撑到一页高度；由于 iframe 无法跨文档分页，内容较长的页面建议直接打开子页地址后再打印。

## 端到端冒烟

`npm run e2e` 在构建产物 `dist/` 上起一个临时静态服务，验证 6 个页面（`index`、`login`、`home`、`workbench`、`table`、`layui`）与 `404.html`、`api/menu.json`、`api/mytsa.config.json`、`robots.txt` 的可用性与关键配置，并逐个请求这些页面引用的本地静态资源（含行内 `url(...)` 引用），确认构建后的路径没有断链。同时校验：noindex 与 referrer 声明、index/iframe 页面无内联脚本、login.html 内联登录跳转且无前端会话代码、前端不依赖会话守卫、登录页/后台入口/iframe 子页面三方资源隔离、菜单地址带内容哈希。该检查会读取 `tab.max`（应为 10）、`menu.data` 等配置，可作为发布前的最后一道链路验证。

## 构建说明

由于 Layui 模块加载依赖 `document.currentScript` 与 `layui.config({ base: ... })`，不能使用 Vite 打包（会破坏模块加载）。因此构建采用静态拷贝脚本 [scripts/build.mjs](scripts/build.mjs)：

1. 清空并整体拷贝 `src/` 到 `dist/`
2. 合并样式：`mytsa.css`、`module/menu.css`、`module/tabPage.css` 合并为 `mytsa.bundle.css`，合并后删除只服务首页的两份模块样式；`mytsa.css` 保留供独立接入使用。项目自有的 `admin.css`、`variables.css`、`reset.css` 合并为 `admin.bundle.css`（仅保留 `variables.css` 作为合并源），首页样式请求由 5 个降到 3 个
3. 使用 Terser 压缩 `.js`、CleanCSS 压缩 `.css`、html-minifier-terser 收缩 `.html`（折叠空白、去注释，不重写内联脚本与样式）；第三方目录 `component/layui/` 原样拷贝、不压缩（通过 `SKIP_PREFIXES` 配置跳过）
4. 注入缓存标记：按最终产物内容计算 SHA-256 前 10 位。`mytsa.js` 中 `layui.config` 的 `version` 使用 `component/mytsa` 下全部 JS 的模块指纹；HTML 中本地 `link/script/img/iframe` 按各自文件哈希追加 `?t=<hash>`；`menu.json` 中本地 `.html` 的 `href` 用页面最终哈希；`mytsa.config.json` 的 `menu.data` 用菜单文件最终哈希。外链、非 HTML 地址与已带标记的地址保持不变，外部接口继续交给服务端 ETag 控制
5. 替换产物：旧目录先备份，新目录原子就位；失败时回滚，避免留下半成品

产物目录：

- `dist/`：Terser/CleanCSS/html-minifier 压缩，用于部署与 npm 包

`npm run check` 会按类型校验产物体积：HTML ≤ 8 KB、项目脚本 ≤ 20 KB、项目 CSS ≤ 16 KB、图片 ≤ 40 KB、JSON ≤ 12 KB，另有单文件 500 KB 兜底上限；`component/layui/` 为第三方原样拷贝目录，不参与预算。超限会直接失败并指出具体文件。

产物替换是带重试的原子操作：旧目录先改名为 `.bak-<时间戳>` 备份，新目录再改名就位；Windows 下遇到 `EPERM`/`EBUSY`（目录被编辑器或预览进程短暂占用）会退避重试，仍失败则把备份改回原位并保留旧产物，不会出现删了一半、两头皆空的情况。

## 部署与缓存

产物中本地资源按文件内容哈希加标记（`mytsa.config.json` 的 `menu.data`、`menu.json` 里的子页 `href` 也一样）：只有内容变化的文件 URL 才变，未变化的 `layui.js`、`layui.css` 等可以继续命中缓存，因此静态资源可长期缓存：

- **HTML**：`Cache-Control: no-cache`（或较短的 `max-age`），保证每次拿到最新的资源哈希。
- **带哈希的静态资源**：`Cache-Control: public, max-age=31536000, immutable`，内容变化后 URL 自然回源。
- **压缩**：`layui.js` 约 389 KB、`layui.css` 约 129 KB，务必开启 gzip 或 Brotli（静态托管一般默认开启）。

Nginx 参考配置：

```nginx
root /path/to/dist;

# 静态资源长期缓存（URL 带内容哈希，内容变化后自然失效）
location ~* \.(js|css|webp|png|svg|gif|ico|woff|woff2|ttf|eot)$ {
	add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML 每次协商
location ~* \.html$ {
	add_header Cache-Control "no-cache";
}

error_page 404 /404.html;
location = /404.html {
	internal;
}
```

对象存储（OSS / COS / S3）在控制台把上述规则写成「缓存策略」与「自定义错误页」即可；GitHub Pages 无需额外配置，内容哈希已保证更新，且 Pages 自带压缩与缓存策略。

## 调试

仓库内置 `.vscode/launch.json`，按 F5 选择「调试 MyTSA」即可；若开发服务器已在运行，选「复用已运行的 dev server」那条。

## 自动部署与发布

推送到 `main` 会触发 Pages 部署，推送 `v*` 标签会触发 Release；二者复用 `.github/workflows/ci.yml` 中的质量检查（`workflow_call`，包含依赖安装、lint、测试、构建、产物校验与 E2E）：

质量检查按 Node 20 / 22 / 24 三版本矩阵执行，产物构建与 artifact 上传只在 Node 24 任务进行（避免同名 artifact 冲突），E2E 也只在 Node 24 任务跑。

- **Deploy GitHub Pages**（`.github/workflows/deploy.yml`）：推送到 `main` 或手动触发，下载 `dist` 产物后部署到 GitHub Pages，访问地址为 <https://initearth.github.io/mytsa-admin-theme/iframe/>。Pages 部署只从 `main` 发起，避免标签触发被环境的部署分支保护拦截；首次部署需在仓库 `Settings → Pages → Source` 中选择 **GitHub Actions**。
- **Release Package**（`.github/workflows/release.yml`）：将 `dist` 打包为 `mytsa-admin-iframe-<tag>.zip`，附加到 Release；并把质量任务产出的 `dist` 发布到 npm 公共源（`@initearth/mytsa-admin-iframe`），仓库归属 `initearth` 时同时发布到 GitHub Packages。发布使用 `npm publish --ignore-scripts`，跳过 `prepublishOnly` 的二次构建，保证 npm 包与 zip 来自同一次构建。发布前会校验标签必须等于 `v<package.json version>`，因此打标签前需先同步 `package.json` 与 `package-lock.json` 的版本号。公共源需要仓库配置 `NPM_TOKEN`（需具备 `@initearth` scope 发布权限），未配置时该步骤自动跳过；配置后使用 `--provenance` 生成来源证明。工作流文件变更只会在其合并到默认分支后生效。

向默认分支提交 Pull Request 时，`.github/workflows/verify.yml` 同样调用 `ci.yml` 执行检查（传 `upload-artifact: false`，不额外上传产物）。

站点信息（仓库与在线预览地址）统一配置在 `mytsa.config.json` 的 `other.links`，由「关于我们」弹窗读取。

## 依赖维护

- `.github/dependabot.yml` 每周一 09:00（Asia/Shanghai）检查 npm 与 GitHub Actions 依赖：npm 的小版本与补丁合并为一个 PR，GitHub Actions 的更新合并为一个 PR；大版本（semver-major）不自动提交，需人工评估后升级。
- CI 在 Node 24 任务中执行 `npm audit --audit-level=high`，出现高危及以上漏洞会直接阻断流水线，其余版本矩阵不重复跑审计。

## 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范，提交信息格式：

```
<type>: <subject>
```

常用 `type`：`feat`（新功能）、`fix`（修复）、`docs`（文档）、`style`（格式）、`refactor`（重构）、`chore`（构建/工具）、`build`（构建系统）。

提交时会自动触发 Git 钩子：`pre-commit` 执行 lint-staged（Prettier 格式化 + ESLint 修复），`commit-msg` 校验提交信息。
