# MyTSA

MyTSA 是基于 [Layui](https://layui.dev/) 框架构建的 iframe 后台管理系统前端模板，使用原生 HTML、CSS 与 JavaScript 开发，提供完整的后台框架、登录页、标签页、菜单、主题配色与 iframe 示例页面。

**预览地址**：<https://initearth.github.io/mytsa-admin-iframe/>

## 功能特性

- 左侧菜单 + 顶部导航 + 多标签页的后台布局
- 标签页按需创建，支持刷新恢复与数量上限
- 基础配色与暗黑模式，支持主题色预设、随机主题色与自定义配色
- iframe 子页面独立资源，支持主题同步与水印
- 打印样式、404 页面与静态资源内容哈希
- 响应式侧栏折叠与移动端适配
- 登录凭据由后端校验，前端用 `layui.data` 持久化 token

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

## 脚本说明

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
│   │   ├── mytsa.config.json       # 站点、菜单、主题与标签配置
│   │   └── menu.json               # 菜单数据
│   ├── component/
│   │   ├── layui/                  # Layui 框架资源
│   │   ├── mytsa/                  # 后台模块：菜单、标签、主题与工具
│   │   └── iframe/                 # iframe 水印组件
│   ├── iframe/
│   │   ├── home.html               # 首页示例
│   │   ├── workbench.html          # 工作台示例
│   │   ├── table.html              # 表格示例
│   │   └── layui.html              # 组件示例
│   └── theme/
│       ├── admin/                  # 后台样式与图片
│       ├── iframe/                 # iframe 子页面样式与脚本
│       └── login/                  # 登录页样式与图片
├── scripts/
│   ├── build.mjs                   # 构建入口
│   ├── check.mjs                   # 产物校验
│   ├── e2e.mjs                     # 端到端链路检查
│   └── lib/                        # 构建与校验工具
├── test/                           # 自动化测试
├── .github/workflows/              # CI、部署与发布流程
├── vite.config.js                  # 开发服务器配置
├── eslint.config.js                # ESLint 配置
└── package.json                    # 依赖与脚本
```

## 配置

站点信息、菜单、主题与标签页行为集中在 `src/api/mytsa.config.json`：

- `site.scope`：站点标识，用于同源多站点间的本地存储与主题隔离（默认 `default`）
- `menu`：菜单数据源与首页地址
- `tab`：标签页上限、会话恢复与首页配置
- `theme.schemes`：基础配色与暗黑模式的区域底色、文字色和模式标记
- `theme.colors`：主题色预设及色阶
- `other`：站点名称、链接、首屏等待时间与水印相关配置

菜单数据位于 `src/api/menu.json`，修改后重新构建即可生效。

## 主题与配色

后台提供两种明暗基调和多组主题色预设：

- `base`：浅色顶栏与标签栏、深色侧栏
- `dark`：深色顶栏、标签栏与侧栏

主题色预设包含 `selected`、`tab`、`header`、`headerText` 与 `shades` 等字段。设置面板支持选择预设、随机生成主题色和自定义区域颜色；选择结果保存在浏览器本地存储中。

暗黑模式下，主框架向 iframe 推送模式与强调色，iframe 使用自身的 `.dark` 样式完成背景和组件覆盖。切回基础配色时会清除同步数据并恢复子页面默认配色。

## 登录与权限

`login.html` 通过 `request/http` 向 `/api/login` 提交表单，成功后跳转到 `panel.html`。账号校验与权限判定由后端服务或网关完成。

`http` 模块通过 `layui.data('mytsa', { mytsa_token: token })` 持久化 token；其余 `localStorage` / `sessionStorage` 仅用于恢复标签页和主题偏好。

## 构建说明

Layui 的模块加载依赖 `document.currentScript` 与动态模块路径，因此构建流程采用静态拷贝与压缩，而不是将源码打入单个 bundle。Vite 仅用于本地开发服务。

构建过程会完成：

1. 拷贝 `src/` 到临时目录
2. 合并项目 CSS，减少页面样式请求
3. 压缩 HTML、CSS 与项目脚本
4. 按文件内容计算哈希并追加缓存标记
5. 原子替换 `dist/`，失败时自动回滚

## 部署

将 `dist/` 部署到任意静态服务器即可。建议：

- HTML 使用 `no-cache` 或较短缓存
- 带哈希的静态资源使用长期缓存
- 开启 gzip 或 Brotli 压缩
- 将 404 错误页指向 `404.html`

Nginx 示例：

```nginx
root /path/to/dist;

location ~* \.(js|css|webp|png|svg|gif|ico|woff|woff2|ttf|eot)$ {
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

CI 会按 Node 20、22、24 三个版本执行质量检查，并在主分支与版本标签推送时执行部署或发布流程。

## 提交规范

项目使用 Conventional Commits，提交信息格式为：

```text
<type>: <subject>
```

常用类型：`feat`、`fix`、`docs`、`style`、`refactor`、`chore`、`build`。提交时会自动执行格式化、代码检查与提交信息校验。

## 许可证

MIT
