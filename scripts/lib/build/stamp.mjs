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

const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

// 给本地资源追加构建标记；外链、锚点与已带标记的地址保持原样
function withStamp(url, buildStamp) {
	if (EXTERNAL_URL.test(url) || /[?&]t=/.test(url)) {
		return url;
	}
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}t=${buildStamp}`;
}

// 给 HTML 中引用的本地脚本、样式、图片追加构建标记，避免发布后缓存未刷新
export async function stampHtmlAssets(distDir, buildStamp) {
	const files = (await walk(distDir)).filter((file) => extname(file).toLowerCase() === '.html');
	for (const file of files) {
		let content = await readFile(file, 'utf8');
		for (const pattern of MARKUP_PATTERNS) {
			content = content.replace(
				pattern,
				(match, open, url, close) => open + withStamp(url, buildStamp) + close
			);
		}
		await writeFile(file, content);
	}
}

// 给 pear.config.json 中指向本地静态 JSON 的菜单地址追加构建标记；
// 后端接口地址保持原样，缓存交给服务端 ETag 控制
export async function stampConfiguration(distDir, buildStamp) {
	const configPath = join(distDir, 'admin', 'config', 'pear.config.json');
	const content = await readFile(configPath, 'utf8');
	const config = JSON.parse(content);
	const data = config.menu && config.menu.data;

	if (typeof data !== 'string' || EXTERNAL_URL.test(data) || !/\.json(?:$|[?#])/i.test(data)) {
		return;
	}

	config.menu.data = withStamp(data, buildStamp);
	await writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
}
