import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	exists,
	walk,
	findMissingReferences,
	validateThemeConfig,
	validateRuntimeConfig,
	DEFAULT_CREDENTIALS,
	detectDefaultCredentials,
} from './lib/validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dirArg = process.argv.find((arg) => arg.startsWith('--dir='));
const dirName = dirArg ? dirArg.slice('--dir='.length) : 'dist';
const isMinified = dirName === 'dist';
const dist = resolve(root, dirName);

// 构建产物必须包含的入口与核心资源
const REQUIRED_FILES = [
	'index.html',
	'login.html',
	'404.html',
	'theme/iframe/home.html',
	'theme/iframe/workbench.html',
	'theme/iframe/table.html',
	'theme/iframe/layui.html',
	'theme/iframe/css/mytsa.css',
	'theme/iframe/js/watermark.js',
	'theme/iframe/js/table.js',
	'theme/iframe/js/workbench.js',
	'theme/iframe/config/mytsa.config.json',
	'component/layui/layui.js',
	'component/mytsa/mytsa.js',
	'component/mytsa/module/theme.js',
	'component/mytsa/module/admin.js',
	'component/mytsa/module/menu.js',
	'component/mytsa/module/tabPage.js',
	'component/mytsa/css/mytsa.css',
	'component/login/js/auth.js',
	'component/login/js/login-bootstrap.js',
	'theme/login/css/login.css',
	'theme/login/css/variables.css',

	'api/mytsa.config.json',
	'theme/admin/js/watermark.js',
	'api/menu.json',
	'api/auth.json',
	'robots.txt',
];

const CONFIG_PATH = 'api/mytsa.config.json';

const strictDebug = process.argv.includes('--strict-debug');
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
const warnings = [];

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

// 演示凭据提醒：默认口令会随产物发布，仅提示不阻断构建
const AUTH_PATH = 'api/auth.json';
if (await exists(join(dist, AUTH_PATH))) {
	try {
		const auth = JSON.parse(await readFile(join(dist, AUTH_PATH), 'utf8'));
		const defaults = detectDefaultCredentials(auth);
		if (defaults.length) {
			warnings.push(
				`${AUTH_PATH} 仍包含默认演示口令 ${DEFAULT_CREDENTIALS.username}/${DEFAULT_CREDENTIALS.password}（${defaults.join('、')}），该文件会随 npm 包与 zip 一起发布，上线前请替换成自己的账号`
			);
		}
	} catch {
		// 解析失败已在 JSON 通用校验中记录
	}
}

const MYTSA_ENTRY = 'component/mytsa/mytsa.js';
if (await exists(join(dist, MYTSA_ENTRY))) {
	const mytsaContent = await readFile(join(dist, MYTSA_ENTRY), 'utf8');
	const stampMatch = mytsaContent.match(/version\s*:\s*["']([^"']*)["']/);
	if (!stampMatch || !stampMatch[1]) {
		errors.push(`${MYTSA_ENTRY} 未注入构建标记（version 为空），layui 模块缓存不会刷新`);
	}
}

const DEBUG_ASSETS = {
	'index.html': 'theme/admin/js/debug.js',
	'login.html': 'theme/login/js/debug.js',
};

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

if (dirName === 'dist') {
	for (const asset of Object.values(DEBUG_ASSETS)) {
		if (await exists(join(dist, asset))) {
			errors.push(`正式产物不应包含 ${asset}`);
		}
	}
	for (const htmlFile of htmlFiles) {
		const html = await readFile(htmlFile, 'utf8');
		for (const asset of Object.values(DEBUG_ASSETS)) {
			if (html.includes(asset)) {
				errors.push(`${pathLabel(htmlFile)} 仍引用 ${asset}`);
			}
		}
	}
	const adminPath = join(dist, 'component', 'mytsa', 'module', 'admin.js');
	if (await exists(adminPath)) {
		const adminSource = await readFile(adminPath, 'utf8');
		if (adminSource.includes('adminDebug')) {
			errors.push('正式产物 admin.js 仍包含调试代码（adminDebug）');
		}
	}
}

if (dirName === 'dist-debug') {
	for (const [page, asset] of Object.entries(DEBUG_ASSETS)) {
		if (!(await exists(join(dist, asset)))) {
			errors.push(`未压缩产物应保留 ${asset}`);
		}
		const content = await readFile(join(dist, page), 'utf8');
		if (!content.includes(asset)) {
			errors.push(`${page} 应保留 ${asset} 引用（未压缩产物）`);
		}
	}
}

for (const file of files) {
	const info = await stat(file);
	const label = pathLabel(file);
	// 类型预算只对压缩产物生效；未压缩的 dist-debug 保留源码体量，仅受兜底上限约束
	const budget = isMinified ? BUDGETS.find((item) => item.match(label)) : undefined;
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

if (warnings.length) {
	for (const message of warnings) {
		console.warn(`提示：${message}`);
	}
}

console.log(
	`检查通过：${htmlFiles.length} 个 HTML、${cssFiles.length} 个 CSS、${jsonFiles.length} 个 JSON，${REQUIRED_FILES.length} 个必要文件`
);
console.log(
	isMinified
		? '尺寸预算：HTML≤8KB、项目脚本≤20KB、项目 CSS≤16KB、图片≤40KB、JSON≤12KB（component/layui/ 不参与）'
		: '尺寸预算：未压缩产物仅校验单文件 500KB 兜底上限'
);
