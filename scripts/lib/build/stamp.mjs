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

// 为 MyTSA 模块注入构建时间戳，作为 layui 模块缓存的刷新参数（不维护手写版本号）
export async function stampMytsaBuild(distDir) {
	const mytsaPath = join(distDir, 'component', 'mytsa', 'mytsa.js');
	const content = await readFile(mytsaPath, 'utf8');
	const buildStamp = Date.now().toString(36);
	// 引号风格随 prettier 配置变化（单/双引号都接受），避免格式化后构建失败
	const stamped = content.replace(
		/version:\s*(['"])(?:\\.|[^'"])*\1/,
		`version: "${buildStamp}"`
	);
	if (stamped === content) {
		throw new Error(
			'构建失败：未能在 mytsa.js 中注入构建标记，请检查 layui.config 的 version 字段'
		);
	}
	await writeFile(mytsaPath, stamped);
	return buildStamp;
}

const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

// 给本地资源追加构建标记；外链、锚点与已带标记的地址保持原样
export function withStamp(url, buildStamp) {
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

// 给 mytsa.config.json 中指向本地静态 JSON 的菜单地址追加构建标记；
// 后端接口地址保持原样，缓存交给服务端 ETag 控制
// 返回原始菜单地址（未加戳），供后续处理菜单数据本身
export async function stampConfiguration(distDir, buildStamp) {
	const configPath = join(distDir, 'admin', 'config', 'mytsa.config.json');
	const content = await readFile(configPath, 'utf8');
	const config = JSON.parse(content);
	const data = config.menu && config.menu.data;

	if (typeof data !== 'string' || EXTERNAL_URL.test(data) || !/\.json(?:$|[?#])/i.test(data)) {
		return null;
	}

	config.menu.data = withStamp(data, buildStamp);
	await writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
	return data;
}

// 给菜单数据中指向本地页面的 href 追加构建标记，避免 iframe 子页命中旧缓存 HTML；
// 外链、非 html 地址与已带标记的地址保持原样
export async function stampMenuData(distDir, buildStamp, dataUrl) {
	if (
		typeof dataUrl !== 'string' ||
		EXTERNAL_URL.test(dataUrl) ||
		!/\.json(?:$|[?#])/i.test(dataUrl)
	) {
		return 0;
	}

	const relative = dataUrl.split(/[?#]/)[0];
	const filePath = join(distDir, ...relative.split('/'));

	let menu;
	try {
		menu = JSON.parse(await readFile(filePath, 'utf8'));
	} catch (error) {
		throw new Error(`构建失败：菜单文件 ${relative} 读取或解析失败：${error.message}`, {
			cause: error,
		});
	}

	let stamped = 0;

	function stampNode(node) {
		if (!node || typeof node !== 'object') {
			return;
		}
		if (Array.isArray(node)) {
			for (const item of node) {
				stampNode(item);
			}
			return;
		}
		if (typeof node.href === 'string' && /\.html(?:$|[?#])/i.test(node.href)) {
			const before = node.href;
			node.href = withStamp(node.href, buildStamp);
			if (node.href !== before) {
				stamped += 1;
			}
		}
		if (node.children) {
			stampNode(node.children);
		}
	}

	stampNode(menu);
	await writeFile(filePath, `${JSON.stringify(menu, null, '\t')}\n`);
	return stamped;
}
