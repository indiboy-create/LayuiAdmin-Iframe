import { rm, cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative, extname, join } from 'node:path';
import { minify as terserMinify } from 'terser';
import CleanCSS from 'clean-css';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'src');

// 可调试构建：跳过压缩，输出源码级可读产物（默认输出到 dist-debug）
const noMinify = process.argv.includes('--no-minify');
const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const dist = resolve(
	root,
	outArg ? outArg.slice('--out='.length) : noMinify ? 'dist-debug' : 'dist'
);

// 第三方目录：原样拷贝，不压缩
const SKIP_PREFIXES = ['component/layui/', 'admin/plugin/'];

const cleanCss = new CleanCSS({ level: 2 });

// 递归收集目录下所有文件
async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

// 压缩 JS/CSS，跳过第三方目录
async function minify() {
	const files = await walk(dist);
	for (const file of files) {
		const rel = relative(dist, file).replace(/\\/g, '/');
		if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;

		const ext = extname(file).toLowerCase();
		if (ext !== '.js' && ext !== '.css') continue;

		const content = await readFile(file, 'utf8');
		if (ext === '.js') {
			// 正式产物移除调试分支：把 window.adminDebug 视作 undefined，交由 Terser 消除
			const source = content.split('window.adminDebug').join('undefined');
			const result = await terserMinify(source, { compress: true, mangle: true });
			if (result.code) await writeFile(file, result.code);
		} else {
			const result = cleanCss.minify(content);
			if (!result.errors.length) await writeFile(file, result.styles);
		}
	}
}

// 统一改写产物中的调试开关：可调试构建开启，正式构建关闭
async function setDebugConfig(value) {
	const configPath = join(dist, 'admin', 'config', 'pear.config.json');
	const content = await readFile(configPath, 'utf8');
	const config = JSON.parse(content);
	config.debug = value;
	await writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
}

// 为 Pear 模块注入构建时间戳，作为 layui 模块缓存的刷新参数（不维护手写版本号）
async function stampPearBuild() {
	const pearPath = join(dist, 'component', 'pear', 'pear.js');
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
async function stampHtmlAssets(buildStamp) {
	const markupPatterns = [
		/(<link\b[^>]*\bhref=["'])([^"']+)(["'])/gi,
		/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
		/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
		/(<iframe\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
		/(<(?:video|audio|source|track)\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
	];

	const withStamp = (url) => {
		if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url) || url.includes('?t=')) {
			return url;
		}
		const separator = url.includes('?') ? '&' : '?';
		return `${url}${separator}t=${buildStamp}`;
	};

	const files = (await walk(dist)).filter((file) => extname(file).toLowerCase() === '.html');
	for (const file of files) {
		let content = await readFile(file, 'utf8');
		for (const pattern of markupPatterns) {
			content = content.replace(
				pattern,
				(match, open, url, close) => open + withStamp(url) + close
			);
		}
		await writeFile(file, content);
	}
}

// 合并 Pear 样式为单文件，减少首页样式请求
async function bundlePearCss() {
	const cssDir = join(dist, 'component', 'pear', 'css');
	const sources = ['module/menu.css', 'module/tabPage.css', 'pear.css'];
	let content = '';
	for (const source of sources) {
		content += `${await readFile(join(cssDir, source), 'utf8')}\n`;
	}
	await writeFile(join(cssDir, 'pear.bundle.css'), content);

	const htmlPath = join(dist, 'index.html');
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

// 正式产物移除调试模块与引用，只保留在 dist-debug
async function stripDebugAssets() {
	await rm(join(dist, 'admin', 'js', 'debug.js'), { force: true });

	const files = (await walk(dist)).filter((file) => extname(file).toLowerCase() === '.html');
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

// 清空旧产物 -> 整体拷贝 -> 注入构建标记 -> 压缩 / 保留可读
await rm(dist, { recursive: true, force: true });
await cp(src, dist, { recursive: true });

const buildStamp = await stampPearBuild();
await bundlePearCss();
if (!noMinify) {
	await stripDebugAssets();
}
await stampHtmlAssets(buildStamp);

// 正式构建强制关闭调试，避免调试日志进入线上产物
await setDebugConfig(noMinify);

if (!noMinify) {
	await minify();
}

console.log(
	noMinify
		? `构建完成（未压缩，保留调试模块）：${dist}`
		: `构建完成（已压缩，已移除调试模块）：${dist}`
);
