# LayuiAdmin-Iframe

基于 [Layui](https://layui.dev/) 的经典后台管理系统前端模板，技术栈为原生 HTML + CSS + JavaScript，采用 Layui 的 AMD（`layui.define`）模块体系。

**在线预览**：<https://indiboy-create.github.io/LayuiAdmin-Iframe/>

## 技术栈

- **Layui**：UI 组件与模块加载
- **Vite**：开发服务器（实时刷新）
- **Terser / CleanCSS**：构建时压缩 JS / CSS
- **ESLint / Prettier**：代码规范与格式化
- **Husky + lint-staged + Commitlint**：Git 提交规范

## 目录结构

```
LayuiAdmin-Iframe
├── src/                    # 源码目录
│   ├── index.html          # 后台主页入口
│   ├── login.html          # 登录页
│   ├── home.html           # 首页示例页
│   ├── workbench.html      # 工作台示例页
│   ├── table.html          # 表格示例页
│   ├── layui.html          # 消息中心示例页
│   ├── admin/              # 主题资源
│   │   ├── config/         # pear 主题配置（菜单/标签/主题色）
│   │   ├── css/            # 主题样式（含 login.css）
│   │   ├── images/         # 静态图片
│   │   ├── js/             # 调试开关与页面脚本（debug/about/message/table）
│   │   └── plugin/         # 插件（如 waterMark）
│   ├── api/                # 菜单/接口数据（menu.json）
│   └── component/
│       ├── layui/          # 第三方 Layui 库（构建时不压缩）
│       └── pear/           # Pear Admin 模块（admin/menu/tabPage/theme/tools）
├── test/
│   └── smoke.test.mjs      # 冒烟测试（菜单/主题/页面结构）
├── scripts/
│   ├── build.mjs           # 构建脚本（静态拷贝 + 压缩）
│   └── check.mjs           # 产物校验脚本
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

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 构建压缩产物到 `dist/` |
| `npm run build:debug` | 构建未压缩产物到 `dist-debug/`（强制开启 debug） |
| `npm run build:all` | 同时构建 `dist/` 与 `dist-debug/` |
| `npm run preview` | 本地预览 `dist/` |
| `npm run check` | 校验 `dist/`（入口文件、HTML/CSS 资源引用、JSON 与主题配置、体积预算、缓存戳） |
| `npm run check:debug` | 校验未压缩产物 `dist-debug/` |
| `npm run check:release` | 校验 `dist/` 并强制 `debug=false`（CI 使用） |
| `npm run test` | 运行冒烟测试（菜单/主题/页面结构） |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 检查并自动修复 |
| `npm run format` | Prettier 格式化 `src`、`scripts`、`test`、根配置文件与 GitHub 工作流 |

## 从 GitHub Packages 安装

```bash
# 1. 配置 GitHub Packages registry（写入用户级或项目级 .npmrc）
echo "@indiboy-create:registry=https://npm.pkg.github.com" >> .npmrc

# 2. 使用具备 read:packages 权限的 GitHub Token
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> .npmrc

# 3. 安装
npm install @indiboy-create/layuiadmin-iframe
```

包内容为 `dist/` 下的静态资源，解压后即可作为站点部署。

## 构建说明

由于 Layui 模块加载依赖 `document.currentScript` 与 `layui.config({ base: ... })`，不能使用 Vite 打包（会破坏模块加载）。因此构建采用静态拷贝脚本 [scripts/build.mjs](scripts/build.mjs)：

1. 清空并整体拷贝 `src/` 到产物目录：压缩版 `dist/`，未压缩版 `dist-debug/`
2. 使用 Terser 压缩 `.js`、CleanCSS 压缩 `.css`
3. 第三方目录 `component/layui/`、`admin/plugin/` 原样拷贝、不压缩（通过 `SKIP_PREFIXES` 配置跳过）
4. 注入缓存刷新标记：把 `pear.js` 中 `layui.config` 的 `version` 替换为构建时间戳，并给 HTML 中本地 `link/script/img/iframe` 等资源追加 `?t=<构建戳>`（不维护手写版本号）
5. 合并 `pear.css`、`module/menu.css`、`module/tabPage.css` 为 `pear.bundle.css`，首页只加载一个样式文件
6. 正式产物移除调试能力：删除 `admin/js/debug.js` 及其 HTML 引用，并把 `window.adminDebug` 视为 `undefined` 交由 Terser 消除调试分支（`dist-debug` 完整保留）

产物目录：

- `dist/`：Terser/CleanCSS 压缩、`debug=false`、不含调试模块，用于部署与 npm 包
- `dist-debug/`：不压缩、`debug=true`、保留 `debug.js`，用于线上问题排查与源码级断点

## 调试

- 统一日志开关：URL 加 `?debug=1` 开启、`?debug=0` 关闭；控制台可执行 `adminDebug.enable()` / `adminDebug.disable()` 临时切换
- 可调试构建：`npm run build:debug`（不压缩、`pear.config.json` 的 `debug` 置为 `true`）
- 断点调试：仓库内置 `.vscode/launch.json`，按 F5 选择「调试 LayuiAdmin-Iframe」即可；若开发服务器已在运行，选「复用已运行的 dev server」那条

## 自动部署与发布

推送 `v*` 标签会同时触发两条工作流，二者复用 `.github/workflows/ci.yml` 中的质量检查（`workflow_call`，包含依赖安装、lint、构建、产物校验并上传 `dist` 产物；发布场景会额外构建并上传未压缩的 `dist-debug`）：

- **Deploy GitHub Pages**（`.github/workflows/deploy.yml`）：下载 `dist` 产物后部署到 GitHub Pages，访问地址为 <https://indiboy-create.github.io/LayuiAdmin-Iframe/>。首次部署需在仓库 `Settings → Pages → Source` 中选择 **GitHub Actions**。
- **Release Package**（`.github/workflows/release.yml`）：将 `dist` 与 `dist-debug` 分别打包为 `layuiadmin-iframe-<tag>.zip`、`layuiadmin-iframe-<tag>-debug.zip`，发布到 GitHub Packages 并在 Release 中附加两个 zip。工作流文件变更只会在其合并到默认分支后生效。

向默认分支提交 Pull Request 时，`.github/workflows/verify.yml` 同样调用 `ci.yml` 执行检查（传 `upload-artifact: false`，不额外上传产物）。

站点信息（仓库与在线预览地址）统一配置在 `pear.config.json` 的 `other.links`，由「关于我们」弹窗读取。

## 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范，提交信息格式：

```
<type>: <subject>
```

常用 `type`：`feat`（新功能）、`fix`（修复）、`docs`（文档）、`style`（格式）、`refactor`（重构）、`chore`（构建/工具）、`build`（构建系统）。

提交时会自动触发 Git 钩子：`pre-commit` 执行 lint-staged（Prettier 格式化 + ESLint 修复），`commit-msg` 校验提交信息。