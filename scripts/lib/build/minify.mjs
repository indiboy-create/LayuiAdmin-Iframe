import { readFile, writeFile } from 'node:fs/promises';
import { extname, relative } from 'node:path';
import { minify as terserMinify } from 'terser';
import CleanCSS from 'clean-css';
import { walk } from '../fs-utils.mjs';

// 第三方目录：原样拷贝，不压缩
const SKIP_PREFIXES = ['component/layui/', 'admin/plugin/'];

// 调试分支替换范围：仅项目自有脚本
const DEBUG_SCOPE = ['admin/js/', 'component/pear/module/'];

const cleanCss = new CleanCSS({ level: 2 });

// 压缩 JS/CSS，跳过第三方目录
export async function minify(distDir) {
	const files = await walk(distDir);
	for (const file of files) {
		const rel = relative(distDir, file).replace(/\\/g, '/');
		if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;

		const ext = extname(file).toLowerCase();
		if (ext !== '.js' && ext !== '.css') continue;

		const content = await readFile(file, 'utf8');
		if (ext === '.js') {
			// 正式产物移除调试分支：仅在项目自有脚本内把 window.adminDebug 视作 undefined
			const source = DEBUG_SCOPE.some((prefix) => rel.startsWith(prefix))
				? content.split('window.adminDebug').join('undefined')
				: content;
			const result = await terserMinify(source, { compress: true, mangle: true });
			if (result.code) await writeFile(file, result.code);
		} else {
			const result = cleanCss.minify(content);
			if (!result.errors.length) await writeFile(file, result.styles);
		}
	}
}
