# MyTSA

MyTSA 是基于 [Layui](https://layui.dev/) 的 iframe 后台管理系统前端模板，使用原生 HTML、CSS 与 JavaScript 开发，包含后台框架、登录页、多标签页、主题配色、背景皮肤与 iframe 示例页面。

**在线预览**：<https://initearth.github.io/mytsa-admin-iframe/>

## 特性

- 左侧菜单 + 顶部导航 + 多标签页的后台布局，支持侧栏折叠与移动端适配
- 标签页按需创建，支持会话恢复、状态保留与数量上限
- 主题模式（light / dark）与 8 组配色方案，支持自定义取色与随机生成
- 背景皮肤：独立于主题与配色，可选图片、整体透明度与整页蒙层，默认不加载
- iframe 子页主题同步（`postMessage`），按 `site.scope` 隔离本地存储
- iframe 水印组件，仅在存在 `.watermark` 容器时绘制
- 登录页、404 页面、打印样式与构建产物内容哈希

## 环境要求

- Node.js：`^20.19.0 || ^22.13.0 || >=24`
- npm：随 Node.js 安装

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 构建静态产物到 dist/
npm run build

# 本地预览构建产物
npm run preview
```

后台入口为 `src/panel.html`，登录页为 `src/login.html`。

## 脚本

| 命令                    | 说明                                       |
| ----------------------- | ------------------------------------------ |
| `npm run dev`           | 启动 Vite 开发服务器                       |
| `npm run build`         | 构建压缩产物到 `dist/`                     |
| `npm run preview`       | 本地预览 `dist/`                           |
| `npm run check`         | 校验产物文件、资源引用、主题配置与体积预算 |
| `npm run check:package` | 校验 npm 包名、版本、文件清单与包体上限    |
| `npm run e2e`           | 在临时静态服务上执行页面与资源链路检查     |
| `npm run test`          | 运行配置、构建与工具函数单测               |
| `npm run lint`          | ESLint 检查                                |
| `npm run lint:fix`      | ESLint 检查并自动修复                      |
| `npm run format`        | 格式化源码、脚本、测试、配置与文档         |
| `npm run format:check`  | 检查格式但不写入文件                       |

## 目录结构

```text
MyTSA
├── src/
│   ├── panel.html                  # 后台入口
│   ├── login.html                  # 登录页
│   ├── 404.html                    # 静态托管错误页
│   ├── api/
│   │   ├── mytsa.config.json       # 站点、菜单、主题、配色与皮肤配置
│   │   ├── menu.json               # 菜单数据
│   │   └── user.json / demo*.json  # iframe 示例数据
│   ├── component/
│   │   ├── layui/                  # Layui 框架资源与扩展样式
│   │   ├── mytsa/                  # 后台模块：菜单、标签页、主题
│   │   ├── iframe/                 # iframe 入口与水印组件
│   │   └── request/                # 请求封装
│   ├── iframe/
│   │   ├── home.html               # 首页示例
│   │   ├── workbench.html          # 工作台示例
│   │   ├── table.html              # 表格示例
│   │   └── layui.html              # 组件示例
│   └── theme/
│       ├── admin/                  # 后台样式与图片
│       ├── iframe/                 # iframe 子页样式与脚本
│       ├── login/                  # 登录页样式与图片
│       └── skins/                  # 背景皮肤图片
├── scripts/
│   ├── build.mjs                   # 构建入口
│   ├── check.mjs                   # 产物校验
│   ├── check-package.mjs           # 包体校验
│   ├── e2e.mjs                     # 端到端链路检查
│   └── lib/                        # 构建与校验工具
├── test/                           # 自动化测试
├── .github/workflows/              # CI、校验、部署与发布流程
├── vite.config.js                  # 开发服务器配置
├── eslint.config.js                # ESLint 配置
└── package.json                    # 依赖与脚本
```

## 配置说明

站点、菜单、标签页、主题、配色与皮肤配置集中在 `src/api/mytsa.config.json`：

| 字段                 | 说明                                                             |
| -------------------- | ---------------------------------------------------------------- |
| `site.scope`         | 站点标识，用于同源多站点间的本地存储与主题隔离（默认 `default`） |
| `logo`               | 站点标题与 LOGO 图片                                             |
| `menu`               | 菜单数据源、请求方式、手风琴与默认选中项                         |
| `tab`                | 标签页上限、状态保留、会话恢复与首页配置                         |
| `theme.defaultMode`  | 默认主题模式（`light` / `dark`）                                 |
| `theme.defaultColor` | 默认配色方案 id                                                  |
| `theme.allowCustom`  | 是否允许自定义配色                                               |
| `theme.modes`        | 主题模式列表                                                     |
| `theme.skins`        | 背景皮肤列表，见下文“背景皮肤”                                   |
| `colors`             | 配色方案，包含主色、侧栏、顶栏、标签栏与色阶                     |
| `other`              | 首屏等待时间与站点链接                                           |

菜单数据位于 `src/api/menu.json`，修改后重新构建即可生效。

### 配色方案

`colors` 中每个方案包含 `side`、`selected`、`logo`、`header`、`headerText`、`tab` 与 `shades`，当前提供 8 组：默认、红、橙、黄、绿、蓝、靛、紫。

主题模式只决定页面明暗，区域颜色全部取自所选配色方案。暗黑模式下顶栏与标签栏使用固定深灰基色（`#141414` / `#1e1e1e`），不随配色方案变化。设置面板支持选择配色、自定义各区域颜色与随机生成配色。

### 背景皮肤

背景皮肤是独立于主题模式与配色方案的全局能力：

- 默认不加载：`--skin-image: none`，配置只提供皮肤清单，不预加载图片
- 选中皮肤后全局按 `--skin-alpha` 半透明，背景图透出；未选皮肤保持不透明
- 整体透明度默认 15%，可在设置面板调整
- 整页蒙层由 `body::after` 实现，取色器开启 `alpha`，颜色与透明度合并配置
- 每个皮肤可在配置中携带默认方案，点击时自动套用：

```json
{
	"id": "01",
	"label": "皮肤 1",
	"src": "/theme/skins/01.jpg",
	"opacity": 15,
	"mask": "rgba(0, 0, 0, 0.15)"
}
```

皮肤与主题相关偏好保存在本地存储（按 `site.scope` 前缀隔离）：`theme-mode`、`theme-color`、`theme-custom-*`、`skin-background`、`skin-opacity`、`skin-mask-color`。

## iframe 与主题同步

- 主框架以 `postMessage`（`mytsa-theme`）向 iframe 推送主题模式与强调色，作用域通过 `mytsa_scope` 参数传递
- 暗黑模式使用 `.dark` 类驱动 layui 组件样式；iframe 背景透明，透出主框架的背景皮肤
- 水印组件仅在 iframe 子页存在 `.watermark` 容器时绘制，未放置容器的页面不会执行水印逻辑

## 登录与权限

`login.html` 通过请求模块向 `/api/login` 提交表单，成功后跳转到 `panel.html`。账号校验与权限判定由后端服务或网关完成，前端仅持久化 token。

## 构建说明

Layui 的模块加载依赖 `document.currentScript` 与动态模块路径，因此构建流程采用静态拷贝与压缩，而不是将源码打入单个 bundle。Vite 仅用于本地开发服务。

构建过程会完成：

1. 拷贝 `src/` 到临时目录
2. 合并项目 CSS，减少页面样式请求
3. 压缩 HTML、CSS 与项目脚本
4. 按文件内容计算哈希并追加缓存标记
5. 原子替换 `dist/`，失败时自动回滚

## 部署

将 `dist/` 部署到任意静态服务器，默认首页指向 `panel.html`。建议：

- HTML 使用 `no-cache` 或较短缓存
- 带哈希的静态资源使用长期缓存
- 开启 gzip 或 Brotli 压缩
- 将 404 错误页指向 `404.html`

Nginx 示例：

```nginx
root /path/to/dist;
index panel.html;

location ~* \.(js|css|webp|png|svg|gif|ico|woff|woff2|ttf|eot|jpg)$ {
	add_header Cache-Control "public, max-age=31536000, immutable";
}

location ~* \.html$ {
	add_header Cache-Control "no-cache";
}

error_page 404 /404.html;
location = /404.html {
	internal;
}
```

## 质量检查

发布前建议执行：

```bash
npm run format:check
npm run lint
npm run test
npm run build
npm run check
npm run e2e
```

`.github/workflows` 中的 CI 会执行格式、Lint、测试、构建与校验，并在主分支与版本标签推送时执行部署或发布流程。

## 提交规范

项目使用 Conventional Commits，提交信息格式为：

```text
<type>: <subject>
```

常用类型：`feat`、`fix`、`docs`、`style`、`refactor`、`chore`、`build`。提交时会自动执行格式化、代码检查与提交信息校验。

## 许可证

MIT
