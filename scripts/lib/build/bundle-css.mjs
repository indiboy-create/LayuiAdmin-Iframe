import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// 合并 MyTSA 样式为单文件，减少首页样式请求
export async function bundleMytsaCss(distDir) {
	const cssDir = join(distDir, 'component', 'mytsa', 'css');
	const sources = ['module/menu.css', 'module/tabPage.css', 'mytsa.css'];
	let content = '';
	for (const source of sources) {
		content += `${await readFile(join(cssDir, source), 'utf8')}\n`;
	}
	await writeFile(join(cssDir, 'mytsa.bundle.css'), content);

	const htmlPath = join(distDir, 'index.html');
	const html = await readFile(htmlPath, 'utf8');
	const next = html
		.replace(
			/[ \t]*<link\b[^>]*href="component\/mytsa\/css\/module\/(?:menu|tabPage)\.css"[^>]*>\r?\n/g,
			''
		)
		.replace(
			/(<link\b[^>]*href=")component\/mytsa\/css\/mytsa\.css(")/,
			'$1component/mytsa/css/mytsa.bundle.css$2'
		);
	if (next !== html) {
		await writeFile(htmlPath, next);
	}

	// 这两份模块样式只服务 index.html，合并后删除避免产物冗余。
	// 首页通过 mytsa.bundle.css 引用；原文件保留供独立接入使用。
	await Promise.all([
		rm(join(cssDir, 'module', 'menu.css'), { force: true }),
		rm(join(cssDir, 'module', 'tabPage.css'), { force: true }),
	]);
}

// 项目自有样式：合并 admin.css / variables.css / reset.css，首页样式请求 5 → 3
const ADMIN_SOURCES = ['admin.css', 'variables.css', 'reset.css'];

export async function bundleAdminCss(distDir) {
	const cssDir = join(distDir, 'theme', 'admin', 'css');
	let content = '';
	for (const source of ADMIN_SOURCES) {
		content += `${await readFile(join(cssDir, source), 'utf8')}\n`;
	}
	await writeFile(join(cssDir, 'admin.bundle.css'), content);

	// 合并后这两份只被 index.html 引用，删除避免产物冗余；variables.css 保留作为合并源
	await Promise.all([
		rm(join(cssDir, 'admin.css'), { force: true }),
		rm(join(cssDir, 'reset.css'), { force: true }),
	]);

	const htmlPath = join(distDir, 'index.html');
	const html = await readFile(htmlPath, 'utf8');
	const next = html
		.replace(
			/[ \t]*<link\b[^>]*href="theme\/admin\/css\/(?:variables|reset)\.css"[^>]*>\r?\n/g,
			''
		)
		.replace(
			/(<link\b[^>]*href=")theme\/admin\/css\/admin\.css(")/,
			'$1theme/admin/css/admin.bundle.css$2'
		);
	if (next !== html) {
		await writeFile(htmlPath, next);
	}
}
