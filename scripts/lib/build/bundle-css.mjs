import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// 合并 Pear 样式为单文件，减少首页样式请求
export async function bundlePearCss(distDir) {
	const cssDir = join(distDir, 'component', 'pear', 'css');
	const sources = ['module/menu.css', 'module/tabPage.css', 'pear.css'];
	let content = '';
	for (const source of sources) {
		content += `${await readFile(join(cssDir, source), 'utf8')}\n`;
	}
	await writeFile(join(cssDir, 'pear.bundle.css'), content);

	const htmlPath = join(distDir, 'index.html');
	const html = await readFile(htmlPath, 'utf8');
	const next = html
		.replace(
			/[ \t]*<link\b[^>]*href="component\/pear\/css\/module\/(?:menu|tabPage)\.css"[^>]*>\r?\n/g,
			''
		)
		.replace(
			/(<link\b[^>]*href=")component\/pear\/css\/pear\.css(")/,
			'$1component/pear/css/pear.bundle.css$2'
		);
	if (next !== html) {
		await writeFile(htmlPath, next);
	}
}
