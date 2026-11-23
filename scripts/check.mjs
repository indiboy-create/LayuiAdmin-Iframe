import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	exists,
	walk,
	findMissingReferences,
	validateThemeConfig,
	validateRuntimeConfig,
} from './lib/validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dirArg = process.argv.find((arg) => arg.startsWith('--dir='));
const dirName = dirArg ? dirArg.slice('--dir='.length) : 'dist';
const dist = resolve(root, dirName);

// 构建产物必须包含的入口与核心资源
const REQUIRED_FILES = [
	'index.html',
	'login.html',
	'home.html',
	'workbench.html',
	'table.html',
	'component/layui/layui.js',
	'component/pear/pear.js',
	'component/pear/module/theme.js',
	'component/pear/module/admin.js',
	'component/pear/module/menu.js',
	'component/pear/module/tabPage.js',
	'component/pear/css/pear.css',
	'admin/js/debug.js',
	'admin/js/bootstrap.js',
	'admin/js/login.js',
	'admin/config/pear.config.json',
	'api/menu.json',
];

const CONFIG_PATH = 'admin/config/pear.config.json';

const strictDebug = process.argv.includes('--strict-debug');
const SIZE_LIMIT = 500 * 1024;

const errors = [];

if (!(await exists(dist))) {
	console.error('::error::未找到构建产物 dist/，请先执行 npm run build');
	process.exit(1);
}

for (const file of REQUIRED_FILES) {
	if (!(await exists(join(dist, file)))) {
		errors.push(`缺少必要文件：${file}`);
	}
}

const files = await walk(dist);
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === '.html');
const cssFiles = files.filter((file) => extname(file).toLowerCase() === '.css');
const jsonFiles = files.filter((file) => extname(file).toLowerCase() === '.json');

errors.push(...(await findMissingReferences({ rootDir: dist, files: htmlFiles, kind: 'html' })));
errors.push(...(await findMissingReferences({ rootDir: dist, files: cssFiles, kind: 'css' })));

let config = null;
for (const jsonFile of jsonFiles) {
	const label = pathLabel(jsonFile);
	try {
		const parsed = JSON.parse(await readFile(jsonFile, 'utf8'));
		if (label === CONFIG_PATH) {
			config = parsed;
		}
	} catch (error) {
		errors.push(`${label} JSON 解析失败：${error.message}`);
	}
}

if (config) {
	validateThemeConfig(config, CONFIG_PATH, errors);
	validateRuntimeConfig(config, CONFIG_PATH, errors);
	if (strictDebug && config.debug !== false) {
		errors.push(`${CONFIG_PATH} 的 debug 应为 false，当前为 ${JSON.stringify(config.debug)}`);
	}
}

const PEAR_ENTRY = 'component/pear/pear.js';
if (await exists(join(dist, PEAR_ENTRY))) {
	const pearContent = await readFile(join(dist, PEAR_ENTRY), 'utf8');
	const stampMatch = pearContent.match(/version\s*:\s*["']([^"']*)["']/);
	if (!stampMatch || !stampMatch[1]) {
		errors.push(`${PEAR_ENTRY} 未注入构建标记（version 为空），layui 模块缓存不会刷新`);
	}
}

const INDEX_PAGE = 'index.html';
if (await exists(join(dist, INDEX_PAGE))) {
	const indexHtml = await readFile(join(dist, INDEX_PAGE), 'utf8');
	if (!/component\/pear\/pear\.js\?t=[\w-]+/.test(indexHtml)) {
		errors.push(`${INDEX_PAGE} 的 pear.js 引用缺少构建戳（?t=），发布后缓存可能不会刷新`);
	}
}

for (const file of files) {
	const info = await stat(file);
	if (info.size > SIZE_LIMIT) {
		errors.push(
			`${pathLabel(file)} 体积 ${(info.size / 1024).toFixed(0)}KB，超过 ${SIZE_LIMIT / 1024}KB 预算`
		);
	}
}

function pathLabel(file) {
	return file.slice(dist.length + 1).replace(/\\/g, '/');
}

if (errors.length) {
	for (const message of errors) {
		console.error(`::error::${message}`);
	}
	process.exit(1);
}

console.log(
	`检查通过：${htmlFiles.length} 个 HTML、${cssFiles.length} 个 CSS、${jsonFiles.length} 个 JSON，${REQUIRED_FILES.length} 个必要文件`
);
