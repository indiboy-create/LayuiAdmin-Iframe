import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// 构建产物必须包含的入口与核心资源
const REQUIRED_FILES = [
	'index.html',
	'login.html',
	'component/layui/layui.js',
	'component/pear/pear.js',
	'component/pear/css/pear.css',
	'admin/config/pear.config.json',
	'api/menu.json',
];

// 外部链接、锚点、脚本协议等无需校验
const SKIP_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

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

async function exists(target) {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

const errors = [];

for (const file of REQUIRED_FILES) {
	if (!(await exists(join(dist, file)))) {
		errors.push(`缺少必要文件：${file}`);
	}
}

const htmlFiles = (await walk(dist)).filter((file) => extname(file).toLowerCase() === '.html');

for (const htmlFile of htmlFiles) {
	const html = await readFile(htmlFile, 'utf8');
	const attrPattern = /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi;

	for (const match of html.matchAll(attrPattern)) {
		const rawValue = match[1].trim();
		if (!rawValue || SKIP_PATTERN.test(rawValue)) continue;

		const cleanValue = rawValue.split('#')[0].split('?')[0];
		if (!cleanValue) continue;

		const target = cleanValue.startsWith('/')
			? resolve(dist, cleanValue.slice(1))
			: resolve(dirname(htmlFile), cleanValue);

		if (!(await exists(target))) {
			const shown = relative(dist, htmlFile).replace(/\\/g, '/');
			errors.push(`${shown} 引用的资源不存在：${rawValue}`);
		}
	}
}

if (errors.length) {
	for (const message of errors) {
		console.error(`::error::${message}`);
	}
	process.exit(1);
}

console.log(`检查通过：${htmlFiles.length} 个 HTML 页面，${REQUIRED_FILES.length} 个必要文件`);