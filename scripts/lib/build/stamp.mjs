import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { walk } from '../fs-utils.mjs';

const MARKUP_PATTERNS = [
	/(<link\b[^>]*\bhref=["'])([^"']+)(["'])/gi,
	/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	/(<iframe\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	/(<(?:video|audio|source|track)\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
];

// 为 Pear 模块注入构建时间戳，作为 layui 模块缓存的刷新参数（不维护手写版本号）
export async function stampPearBuild(distDir) {
	const pearPath = join(distDir, 'component', 'pear', 'pear.js');
	const content = await readFile(pearPath, 'utf8');
	const buildStamp = Date.now().toString(36);
	const stamped = content.replace(/version:\s*""/, `version: "${buildStamp}"`);
	if (stamped === content) {
		throw new Error(
			'构建失败：未能在 pear.js 中注入构建标记，请检查 layui.config 的 version 字段'
		);
	}
	await writeFile(pearPath, stamped);
	return buildStamp;
}

// 给 HTML 中引用的本地脚本、样式、图片追加构建标记，避免发布后缓存未刷新
export async function stampHtmlAssets(distDir, buildStamp) {
	const withStamp = (url) => {
		if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url) || url.includes('?t=')) {
			return url;
		}
		const separator = url.includes('?') ? '&' : '?';
		return `${url}${separator}t=${buildStamp}`;
	};

	const files = (await walk(distDir)).filter((file) => extname(file).toLowerCase() === '.html');
	for (const file of files) {
		let content = await readFile(file, 'utf8');
		for (const pattern of MARKUP_PATTERNS) {
			content = content.replace(
				pattern,
				(match, open, url, close) => open + withStamp(url) + close
			);
		}
		await writeFile(file, content);
	}
}
