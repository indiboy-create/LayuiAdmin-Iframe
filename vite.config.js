import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// 本项目为 Layui 经典静态模板（非 ESM 模块体系），
// 因此 Vite 仅作为开发服务器（提供实时刷新），构建交由 scripts/build.mjs 完成静态拷贝。
export default defineConfig({
	root: 'src',
	base: './',
	server: {
		port: 8080,
		open: true,
	},
	build: {
		// build.outDir 供 `vite preview` 使用，与构建脚本输出的 dist 保持一致
		outDir: resolve(process.cwd(), 'dist'),
		emptyOutDir: false,
	},
});
