import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { walk } from '../fs-utils.mjs';

const MARKUP_PATTERNS = [
	/(<link\b[^>]*\bhref=["'])([^"']+)(["'])/gi,
	/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	/(<iframe\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	/(<(?:video|audio|source|track)\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
];

const EXTERNAL_URL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

function digest(input) {
	return createHash('sha256').update(input).digest('hex').slice(0, 10);
}

function normalizeRelative(filePath) {
	return filePath.split(sep).join('/');
}

function urlPath(url) {
	return url.split(/[?#]/)[0];
}

// 以 dist 根目录为基准解析菜单/配置中的本地地址
function rootKey(url) {
	const path = urlPath(url).replace(/^\/+/, '');
	return path ? normalizeRelative(path) : '';
}

// 以引用它的 HTML 文件所在目录为基准解析资源地址
function assetKey(distDir, htmlFile, url) {
	const raw = urlPath(url);
	if (!raw) {
		return '';
	}
	const target = raw.startsWith('/')
		? resolve(distDir, raw.replace(/^\/+/, ''))
		: resolve(dirname(htmlFile), raw);
	const key = normalizeRelative(relative(distDir, target));
	return key.startsWith('../') ? '' : key;
}

export async function hashFile(filePath) {
	return digest(await readFile(filePath));
}

// 为产物中的每个文件计算内容哈希，供 HTML/菜单引用按文件粒度加戳
export async function hashTree(distDir) {
	const hashes = new Map();
	for (const file of await walk(distDir)) {
		hashes.set(normalizeRelative(relative(distDir, file)), await hashFile(file));
	}
	return hashes;
}

// 注入 MyTSA 模块指纹，作为 layui 模块缓存的刷新参数。
// 指纹覆盖 mytsa.js 与全部模块脚本，任一模块变化都会让缓存失效；同一份源码重复构建结果稳定。
export async function stampMytsaBuild(distDir) {
	const mytsaDir = join(distDir, 'component', 'mytsa');
	const files = (await walk(mytsaDir)).filter((file) => extname(file).toLowerCase() === '.js');
	if (!files.length) {
		throw new Error('构建失败：component/mytsa 下没有找到模块脚本');
	}

	const parts = [];
	for (const file of files.sort()) {
		const rel = normalizeRelative(relative(mytsaDir, file));
		let content = await readFile(file, 'utf8');
		if (rel === 'mytsa.js') {
			// 排除当前注入值，保证重复构建的指纹稳定
			content = content.replace(/version:\s*(['"])(?:\\.|[^'"])*\1/, 'version: ""');
		}
		parts.push(`${rel}\n${content}`);
	}
	const version = digest(parts.join('\n'));

	const mytsaPath = join(mytsaDir, 'mytsa.js');
	const content = await readFile(mytsaPath, 'utf8');
	// 引号风格随 prettier 配置变化（单/双引号都接受），避免格式化后构建失败
	const stamped = content.replace(/version:\s*(['"])(?:\\.|[^'"])*\1/, `version: "${version}"`);
	if (stamped === content) {
		throw new Error(
			'构建失败：未能在 mytsa.js 中注入构建标记，请检查 layui.config 的 version 字段'
		);
	}
	await writeFile(mytsaPath, stamped);
	return version;
}

// 给本地资源追加构建标记；外链、锚点与已带标记的地址保持原样
export function withStamp(url, stamp) {
	if (EXTERNAL_URL.test(url) || /[?&]t=/.test(url)) {
		return url;
	}
	const separator = url.includes('?') ? '&' : '?';
	return `${url}${separator}t=${stamp}`;
}

function stampForUrl(stampOrMap, key) {
	if (typeof stampOrMap === 'string') {
		return stampOrMap;
	}
	return key && stampOrMap instanceof Map ? stampOrMap.get(key) : '';
}

// 给 HTML 中引用的本地脚本、样式、图片按文件内容哈希加戳，避免发布后缓存未刷新。
// 第二个参数既支持旧的统一字符串（测试/兼容），也支持 hashTree 生成的文件哈希表。
export async function stampHtmlAssets(distDir, stampOrMap) {
	const files = (await walk(distDir)).filter((file) => extname(file).toLowerCase() === '.html');
	for (const file of files) {
		let content = await readFile(file, 'utf8');
		for (const pattern of MARKUP_PATTERNS) {
			content = content.replace(pattern, (match, open, url, close) => {
				const key = assetKey(distDir, file, url);
				const stamp = stampForUrl(stampOrMap, key);
				return open + (stamp ? withStamp(url, stamp) : url) + close;
			});
		}
		await writeFile(file, content);
	}
}

// 读取配置中声明的菜单数据地址，供构建阶段决定是否需要继续处理菜单文件
export async function getMenuDataUrl(distDir) {
	const configPath = join(distDir, 'admin', 'config', 'mytsa.config.json');
	const config = JSON.parse(await readFile(configPath, 'utf8'));
	const data = config.menu && config.menu.data;
	return typeof data === 'string' ? data : null;
}

// 给 mytsa.config.json 中指向本地静态 JSON 的菜单地址追加标记；
// 后端接口地址保持原样，缓存交给服务端 ETag 控制。
// 返回原始菜单地址（未加戳），供后续处理菜单数据本身。
export async function stampConfiguration(distDir, stampOrMap) {
	const configPath = join(distDir, 'admin', 'config', 'mytsa.config.json');
	const content = await readFile(configPath, 'utf8');
	const config = JSON.parse(content);
	const data = config.menu && config.menu.data;

	if (typeof data !== 'string' || EXTERNAL_URL.test(data) || !/\.json(?:$|[?#])/i.test(data)) {
		return null;
	}

	const stamp = stampForUrl(stampOrMap, rootKey(data));
	if (!stamp) {
		return data;
	}
	config.menu.data = withStamp(data, stamp);
	await writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
	return data;
}

// 给菜单数据中指向本地页面的 href 按页面内容哈希加戳，避免 iframe 子页命中旧缓存 HTML；
// 外链、非 html 地址与已带标记的地址保持原样。
export async function stampMenuData(distDir, stampOrMap, dataUrl) {
	if (
		typeof dataUrl !== 'string' ||
		EXTERNAL_URL.test(dataUrl) ||
		!/\.json(?:$|[?#])/i.test(dataUrl)
	) {
		return 0;
	}

	const relativePath = urlPath(dataUrl);
	const filePath = join(distDir, ...relativePath.split('/'));

	let menu;
	try {
		menu = JSON.parse(await readFile(filePath, 'utf8'));
	} catch (error) {
		throw new Error(`构建失败：菜单文件 ${relativePath} 读取或解析失败：${error.message}`, {
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
			const stamp = stampForUrl(stampOrMap, rootKey(node.href));
			if (stamp) {
				node.href = withStamp(node.href, stamp);
			}
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
