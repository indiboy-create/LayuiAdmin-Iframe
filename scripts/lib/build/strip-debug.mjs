import { readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { walk } from '../fs-utils.mjs';

// 正式产物移除调试模块与引用，只保留在 dist-debug
export async function stripDebugAssets(distDir) {
	await rm(join(distDir, 'admin', 'js', 'debug.js'), { force: true });

	const files = (await walk(distDir)).filter((file) => extname(file).toLowerCase() === '.html');
	for (const file of files) {
		const content = await readFile(file, 'utf8');
		const next = content.replace(
			/[ \t]*<script\b[^>]*src=["'][^"']*admin\/js\/debug\.js["'][^>]*><\/script>\r?\n?/g,
			''
		);
		if (next !== content) {
			await writeFile(file, next);
		}
	}
}
