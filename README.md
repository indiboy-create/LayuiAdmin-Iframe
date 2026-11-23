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
| `npm run build` | 构建产物到 `dist/` |
| `npm run build:debug` | 可调试构建（不压缩、强制开启 debug） |
| `npm run preview` | 本地预览 `dist/` |
| `npm run check` | 校验构建产物（入口文件、HTML/CSS 资源引用、JSON 与主题配置） |
| `npm run test` | 运行冒烟测试（菜单/主题/页面结构） |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 检查并自动修复 |
| `npm run format` | Prettier 格式化 `src`、`scripts`、`test`、根配置文件与 GitHub 工作流 |

## 构建说明

由于 Layui 模块加载依赖 `document.currentScript` 与 `layui.config({ base: ... })`，不能使用 Vite 打包（会破坏模块加载）。因此构建采用静态拷贝脚本 [scripts/build.mjs](scripts/build.mjs)：

1. 清空并整体拷贝 `src/` 到 `dist/`
2. 使用 Terser 压缩 `.js`、CleanCSS 压缩 `.css`
3. 第三方目录 `component/layui/`、`admin/plugin/` 原样拷贝、不压缩（通过 `SKIP_PREFIXES` 配置跳过）

## 自动部署与发布

推送 `v*` 标签（如 `v1.0.0`）会同时触发两条工作流，二者复用 `.github/workflows/ci.yml` 中的质量检查（`workflow_call`，包含依赖安装、lint、构建、产物校验并上传 `dist` 产物）：

- **Deploy GitHub Pages**（`.github/workflows/deploy.yml`）：下载 `dist` 产物后部署到 GitHub Pages，访问地址为 <https://indiboy-create.github.io/LayuiAdmin-Iframe/>。首次部署需在仓库 `Settings → Pages → Source` 中选择 **GitHub Actions**。
- **Release Package**（`.github/workflows/release.yml`）：校验标签与 `package.json` 版本一致后，将 `dist` 打包为 zip 并发布到 GitHub Packages，同时自动创建 Release 并附加 zip。工作流文件变更只会在其合并到默认分支后生效。

向默认分支提交 Pull Request 时，`.github/workflows/verify.yml` 同样调用 `ci.yml` 执行检查（传 `upload-artifact: false`，不额外上传产物）。

站点信息（仓库与在线预览地址）统一配置在 `pear.config.json` 的 `other.links`，由「关于我们」弹窗读取。

## 提交规范

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 规范，提交信息格式：

```
<type>: <subject>
```

常用 `type`：`feat`（新功能）、`fix`（修复）、`docs`（文档）、`style`（格式）、`refactor`（重构）、`chore`（构建/工具）、`build`（构建系统）。

提交时会自动触发 Git 钩子：`pre-commit` 执行 lint-staged（Prettier 格式化 + ESLint 修复），`commit-msg` 校验提交信息。