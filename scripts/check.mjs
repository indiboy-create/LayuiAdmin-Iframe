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
const dist = resolve(root, 'dist');

// 构建产物必须包含的入口与核心资源
const REQUIRED_FILES = [
	'index.html',
	'login.html',
	'404.html',
	'iframe/home.html',
	'iframe/workbench.html',
	'iframe/table.html',
	'iframe/layui.html',
	'theme/iframe/css/iframe.css',
	'theme/iframe/js/table.js',
	'theme/iframe/js/workbench.js',
	'component/layui/layui.js',
	'component/mytsa/mytsa.js',
	'component/mytsa/module/theme.js',
	'component/mytsa/module/admin.js',
	'component/mytsa/module/menu.js',
	'component/mytsa/module/tabPage.js',
	'component/iframe/iframe.js',
	'component/iframe/module/watermark.js',
	'component/mytsa/css/mytsa.css',
	'theme/login/css/login.css',

	'api/mytsa.config.json',
	'api/menu.json',
	'robots.txt',
];

const CONFIG_PATH = 'api/mytsa.config.json';

const SIZE_LIMIT = 500 * 1024;

// 按类型设置体积预算，防止单页/单文件在后续改动中悄悄膨胀；
// component/layui/ 是第三方原样拷贝目录，不参与预算（其体积由上游决定）
const BUDGETS = [
	{ label: 'HTML', match: (path) => path.endsWith('.html'), limit: 8 * 1024 },
	{
		label: '项目脚本',
		match: (path) => path.endsWith('.js') && !path.startsWith('component/layui/'),
		limit: 20 * 1024,
	},
	{
		label: '项目 CSS',
		match: (path) => path.endsWith('.css') && !path.startsWith('component/layui/'),
		limit: 16 * 1024,
	},
	{
		label: '图片',
		match: (path) => /^theme\/admin\/images\/.*\.(webp|png|jpe?g|svg|gif)$/i.test(path),
		limit: 40 * 1024,
	},
	{ label: 'JSON', match: (path) => path.endsWith('.json'), limit: 12 * 1024 },
];

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
}

const MYTSA_ENTRY = 'component/mytsa/mytsa.js';
if (await exists(join(dist, MYTSA_ENTRY))) {
	const mytsaContent = await readFile(join(dist, MYTSA_ENTRY), 'utf8');
	const stampMatch = mytsaContent.match(/version\s*:\s*["']([^"']*)["']/);
	if (!stampMatch || !stampMatch[1]) {
		errors.push(`${MYTSA_ENTRY} 未注入构建标记（version 为空），layui 模块缓存不会刷新`);
	}
}

// 每个页面都应至少有一个带构建戳的本地资源引用，并声明不被搜索引擎收录
for (const htmlFile of htmlFiles) {
	const html = await readFile(htmlFile, 'utf8');
	if (!/\b(?:src|href)=["'][^"']+\?t=[\w-]+["']/.test(html)) {
		errors.push(`${pathLabel(htmlFile)} 未包含带构建戳（?t=）的本地资源引用`);
	}
	if (!/<meta\s+name=["']robots["'][^>]*\bnoindex/i.test(html)) {
		errors.push(`${pathLabel(htmlFile)} 未声明 robots noindex，后台页面可能被搜索引擎收录`);
	}
	if (!/<meta\s+name=["']referrer["'][^>]*no-referrer/i.test(html)) {
		errors.push(`${pathLabel(htmlFile)} 未声明 referrer no-referrer`);
	}
}

// 菜单数据中指向本地页面的地址应带构建戳，避免 iframe 子页命中旧缓存
if (config && config.menu && typeof config.menu.data === 'string') {
	const menuPath = config.menu.data.split(/[?#]/)[0];
	if (
		/\.json$/i.test(menuPath) &&
		!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(menuPath) &&
		(await exists(join(dist, ...menuPath.split('/'))))
	) {
		const menuFile = join(dist, ...menuPath.split('/'));
		const menu = JSON.parse(await readFile(menuFile, 'utf8'));
		const unstamped = [];

		(function walkMenu(node) {
			if (!node || typeof node !== 'object') {
				return;
			}
			if (Array.isArray(node)) {
				for (const item of node) {
					walkMenu(item);
				}
				return;
			}
			if (
				typeof node.href === 'string' &&
				/\.html(?:$|[?#])/i.test(node.href) &&
				!/[?&]t=/.test(node.href)
			) {
				unstamped.push(node.href);
			}
			if (node.children) {
				walkMenu(node.children);
			}
		})(menu);

		if (unstamped.length) {
			errors.push(`${menuPath} 中有未加构建戳的页面地址：${unstamped.join('、')}`);
		}
	}
}

for (const file of files) {
	const info = await stat(file);
	const label = pathLabel(file);
	const budget = BUDGETS.find((item) => item.match(label));
	const limit = budget ? budget.limit : SIZE_LIMIT;
	if (info.size > limit) {
		const scope = budget ? budget.label : '单文件';
		errors.push(
			`${label} 体积 ${(info.size / 1024).toFixed(1)}KB，超过${scope}预算 ${(limit / 1024).toFixed(0)}KB`
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
console.log(
	'尺寸预算：HTML≤8KB、项目脚本≤20KB、项目 CSS≤16KB、图片≤40KB、JSON≤12KB（component/layui/ 不参与）'
);
