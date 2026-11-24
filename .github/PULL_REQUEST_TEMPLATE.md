<!-- 标题请遵循 Conventional Commits，例如：fix: 会话恢复时按 tab.max 截断标签 -->

## 改动内容

<!-- 一句话说明做了什么，以及为什么要做 -->

## 关联 Issue

<!-- Closes #123 / 无 -->

## 类型

- [ ] 修复（fix）
- [ ] 新功能（feat）
- [ ] 重构（refactor）
- [ ] 文档（docs）
- [ ] 构建 / 工程化（build / chore）

## 自检清单

- [ ] `npx eslint .` 通过
- [ ] `npm run test` 通过
- [ ] `npm run build:all` 成功
- [ ] `npm run check:release`、`npm run check:debug` 通过
- [ ] `npm run e2e` 通过
- [ ] `npx prettier --check "src/**/*" "scripts/**/*.mjs" "test/**/*.mjs" "*.config.js" ".github/workflows/*.yml" README.md` 通过
- [ ] 已在浏览器（`npm run dev` 或 `npm run preview`）手工验证改动路径
- [ ] **未修改 `src/component/layui/`**（第三方目录，构建时原样拷贝）

## 影响面与回滚

<!-- 是否影响发布产物 / npm 包 / CSP / 无障碍；出问题如何回滚 -->

## 截图或录屏

<!-- 涉及界面改动时附上；纯逻辑改动可删除本节 -->
