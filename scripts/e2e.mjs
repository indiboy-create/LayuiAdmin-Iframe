import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dirArg = process.argv.find((arg) => arg.startsWith('--dir='));
const dirName = dirArg ? dirArg.slice('--dir='.length) : 'dist';
const dist = resolve(root, dirName);

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.htm': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.eot': 'application/vnd.ms-fontobject',
	'.txt': 'text/plain; charset=utf-8',
};

const errors = [];
let passed = 0;

function ok(name, condition, detail) {
	if (condition) {
		passed += 1;
		console.log(`  ok    ${name}`);
		return;
	}
	errors.push(`${name}${detail ? `（${detail}）` : ''}`);
	console.log(`  FAIL  ${name}${detail ? `（${detail}）` : ''}`);
}

async function exists(path) {
	try {
		await stat(path);
		return true;
	} catch (error) {
		return false;
	}
}

function startServer() {
	const server = createServer(async (req, res) => {
		let pathname;
		try {
			pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
		} catch (error) {
			res.writeHead(400).end('bad request');
			return;
		}
		if (pathname === '/') {
			pathname = '/index.html';
		}

		const filePath = resolve(dist, `.${pathname}`);
		if (!filePath.startsWith(dist)) {
			res.writeHead(403).end('forbidden');
			return;
		}

		try {
			const body = await readFile(filePath);
			res.writeHead(200, {
				'content-type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
				'cache-control': 'no-store',
			});
			res.end(body);
		} catch (error) {
			res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
		}
	});

	return new Promise((done) => {
		server.listen(0, '127.0.0.1', () => done(server));
	});
}

async function request(base, path) {
	const response = await fetch(`${base}${path}`, { headers: { accept: '*/*' } });
	const text = await response.text();
	return { status: response.status, text };
}

function collectAssets(html, page = '/index.html') {
	const pageDir = page.slice(0, page.lastIndexOf('/') + 1) || '/';
	const resolveUrl = (url) => new URL(url, `http://e2e.local${pageDir}`).pathname;
	const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
	const inlineUrls = [...html.matchAll(/url\(\s*['"]?([^'")\s]+)['"]?\s*\)/g)].map(
		(match) => match[1]
	);

	return [
		...new Set(
			[...references, ...inlineUrls]
				.filter((url) => url && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url))
				.map((url) => resolveUrl(url.split('?')[0].split('#')[0]))
				.filter(Boolean)
		),
	];
}

function parseJson(label, text) {
	try {
		return JSON.parse(text);
	} catch (error) {
		errors.push(`${label} 不是合法 JSON`);
		return null;
	}
}

console.log(`E2E 目标：${dist}`);

if (!(await exists(resolve(dist, 'index.html')))) {
	console.error('::error::未找到构建产物，请先执行 npm run build');
	process.exit(1);
}

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;

try {
	const index = await request(base, '/index.html');
	ok('index.html 可访问', index.status === 200, `HTTP ${index.status}`);
	ok(
		'index.html 不依赖前端会话守卫',
		!index.text.includes('theme/admin/js/auth.js') && !/data-guard\b/.test(index.text)
	);
	ok('index.html 声明 noindex', /<meta\s+name="robots"[^>]*noindex/i.test(index.text));
	ok(
		'index.html 侧边栏底部仅含一个 GitHub 链接',
		/mytsa-side-links/.test(index.text) &&
			/github\.com\/initearth\/mytsa-admin-iframe/.test(index.text) &&
			!/initearth\.github\.io/.test(index.text) &&
			/id="side"[\s\S]*mytsa-side-links/.test(index.text)
	);
	ok(
		'index.html 用户导航项为头像加用户名与用户组',
		/class="layui-nav-item user"/.test(index.text) &&
			/class="user-entry"/.test(index.text) &&
			/class="user-avatar"/.test(index.text) &&
			/theme\/admin\/images\/avatar\.svg/.test(index.text) &&
			/>管理员<\/span>/.test(index.text) &&
			/>超级管理员组<\/span>/.test(index.text)
	);
	ok(
		'index.html 内联后台引导逻辑',
		/<script(?![^>]*\bsrc=)[^>]*>/i.test(index.text) &&
			index.text.includes('admin.setConfigurationPath') &&
			index.text.includes('admin.render()') &&
			!index.text.includes('theme/admin/js/bootstrap.js')
	);
	ok(
		'index.html 声明 referrer no-referrer',
		/<meta\s+name="referrer"[^>]*no-referrer/i.test(index.text)
	);
	ok('index.html 引入 mytsa 组件入口', /component\/mytsa\/mytsa\.js/.test(index.text));
	ok('index.html 引入 iframe 水印组件入口', /component\/iframe\/iframe\.js/.test(index.text));
	ok('index.html 与登录资源隔离', !/(?:theme\/login|component\/login)\//.test(index.text));

	const watermark = await request(base, '/component/iframe/module/watermark.js');
	ok(
		'watermark 模块导出 render 且只在顶层窗口绘制',
		watermark.status === 200 &&
			/window\.top\s*[!=]==?\s*window\.self/.test(watermark.text) &&
			/render\s*:/.test(watermark.text),
		`HTTP ${watermark.status}`
	);
	const printCss = await request(base, '/component/mytsa/css/mytsa.css');
	ok(
		'mytsa.css 含打印样式',
		printCss.status === 200 && /@media print/.test(printCss.text),
		`HTTP ${printCss.status}`
	);

	const login = await request(base, '/login.html');
	ok('login.html 可访问', login.status === 200, `HTTP ${login.status}`);
	ok(
		'login.html 内联登录跳转',
		/<script>[\s\S]*submit\(login\)[\s\S]*index\.html[\s\S]*<\/script>/.test(login.text)
	);
	ok(
		'login.html 声明 referrer no-referrer',
		/<meta\s+name="referrer"[^>]*no-referrer/i.test(login.text)
	);
	ok(
		'login.html 与后台资源隔离',
		!/(?:theme\/admin|component\/mytsa|component\/login)\//.test(login.text)
	);
	ok('login.html 不声明 theme-color', !/<meta\s+name="theme-color"/i.test(login.text));
	ok(
		'login.html 无前端会话代码',
		!/sessionStorage|localStorage|data-guard-login/.test(login.text)
	);

	const menu = await request(base, '/api/menu.json');
	ok('api/menu.json 可访问', menu.status === 200, `HTTP ${menu.status}`);
	const menuData = parseJson('api/menu.json', menu.text);
	ok('api/menu.json 是非空数组', Boolean(Array.isArray(menuData) && menuData.length > 0));

	const unstampedPages = [];
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
			unstampedPages.push(node.href);
		}
		if (node.children) {
			walkMenu(node.children);
		}
	})(menuData);
	ok('api/menu.json 的页面地址带构建戳', unstampedPages.length === 0, unstampedPages.join('、'));

	const robots = await request(base, '/robots.txt');
	ok(
		'robots.txt 禁止抓取',
		robots.status === 200 && /Disallow:\s*\//i.test(robots.text),
		`HTTP ${robots.status}`
	);

	const config = await request(base, '/api/mytsa.config.json');
	ok('mytsa.config.json 可访问', config.status === 200, `HTTP ${config.status}`);
	const configData = parseJson('mytsa.config.json', config.text);
	ok(
		'菜单配置指向数据文件',
		Boolean(configData && configData.menu && typeof configData.menu.data === 'string'),
		'menu.data 缺失'
	);
	ok(
		'标签页上限已收敛',
		Boolean(configData && configData.tab && configData.tab.max === 10),
		`tab.max=${configData && configData.tab && configData.tab.max}`
	);
	ok(
		'所有配色方案均配置标签栏与配套选中色',
		Boolean(
			configData &&
			Array.isArray(configData.theme?.schemes) &&
			Array.isArray(configData.colors) &&
			configData.theme.schemes.length > 0 &&
			configData.theme.schemes.every(
				(scheme) =>
					/^#[0-9a-f]{6}$/i.test(scheme.tab || '') &&
					/^#[0-9a-f]{6}$/i.test(scheme.selected || '') &&
					configData.colors.some(
						(color) =>
							String(color.selected).toLowerCase() ===
							String(scheme.selected || '').toLowerCase()
					)
			)
		),
		'theme.schemes[].tab / selected 缺失或未匹配 colors'
	);
	ok(
		'主题色提供 header 与扩展色阶',
		Boolean(
			configData &&
			Array.isArray(configData.colors) &&
			configData.colors.length > 0 &&
			configData.colors.every(
				(color) =>
					/^#[0-9a-f]{6}$/i.test(color.header || '') &&
					Array.isArray(color.shades) &&
					color.shades.every((value) => /^#[0-9a-f]{6}$/i.test(value))
			)
		),
		'colors[].header / shades 缺失'
	);

	const pages = [
		'/index.html',
		'/login.html',
		'/iframe/home.html',
		'/iframe/workbench.html',
		'/iframe/table.html',
		'/iframe/layui.html',
	];
	const pageSources = [
		{ page: '/index.html', html: index.text },
		{ page: '/login.html', html: login.text },
	];

	for (const page of pages.slice(2)) {
		const response = await request(base, page);
		ok(`${page} 可访问`, response.status === 200, `HTTP ${response.status}`);
		ok(`${page} 声明 noindex`, /<meta\s+name="robots"[^>]*noindex/i.test(response.text));
		ok(`${page} 不使用 data- 属性配置水印`, !/data-watermark-/i.test(response.text));
		ok(
			`${page} 声明 referrer no-referrer`,
			/<meta\s+name="referrer"[^>]*no-referrer/i.test(response.text)
		);
		ok(
			`${page} 与后台/登录资源隔离`,
			!/(?:theme\/admin|component\/login|theme\/login)\//.test(response.text)
		);
		ok(`${page} 引入 iframe 水印组件入口`, /component\/iframe\/iframe\.js/.test(response.text));
		const watermarkParams = [
			'text',
			'fontSize',
			'fontFamily',
			'color',
			'opacity',
			'tileWidth',
			'tileHeight',
			'offsetX',
			'offsetY',
			'rotate',
			'zIndex',
			'target',
		];
		ok(
			`${page} 通过 layui.use 回调配置完整水印参数`,
			/layui\.use\(\['watermark'\]/.test(response.text) &&
				/watermark\.render\(\{/.test(response.text) &&
				watermarkParams.every((key) => new RegExp(`\\b${key}\\s*:`).test(response.text))
		);
		pageSources.push({ page, html: response.text });
	}

	const notFound = await request(base, '/404.html');
	ok('404.html 可访问', notFound.status === 200, `HTTP ${notFound.status}`);
	ok(
		'404.html 声明 referrer no-referrer',
		/<meta\s+name="referrer"[^>]*no-referrer/i.test(notFound.text)
	);
	pageSources.push({ page: '/404.html', html: notFound.text });

	const mytsaEntry = await request(base, '/component/mytsa/mytsa.js');
	ok(
		'mytsa.js 通过 layui.link 模块化加载样式',
		mytsaEntry.status === 200 &&
			/layui\.link\(/.test(mytsaEntry.text) &&
			/mytsa\.bundle\.css/.test(mytsaEntry.text)
	);
	const mytsaBundle = await request(base, '/component/mytsa/css/mytsa.bundle.css');
	ok('mytsa 合并样式可访问', mytsaBundle.status === 200, `HTTP ${mytsaBundle.status}`);
	const tabPageModule = await request(base, '/component/mytsa/module/tabPage.js');
	ok(
		'标签页右键菜单已删除',
		tabPageModule.status === 200 &&
			!/contextmenu/.test(tabPageModule.text) &&
			!/mytsa-tab-page-menu/.test(tabPageModule.text) &&
			!/mytsa-tab-page-menu/.test(mytsaBundle.text),
		'标签页右键菜单仍存在'
	);
	ok(
		'标签栏样式与配色方案独立联动',
		/mytsa-tab-page>.layui-tab-title\{[^}]*background-color:var\(--scheme-tab\)/.test(
			mytsaBundle.text
		) &&
			/mytsa-tab-page>.layui-tab-title li\{[^}]*color:var\(--scheme-tab-text\)/.test(
				mytsaBundle.text
			) &&
			/--scheme-tab-border/.test(mytsaBundle.text)
	);
	ok(
		'标签页激活圆点无右侧外边距',
		!/\.mytsa-tab-page>\.layui-tab-title \.mytsa-tab-page-active\{[^}]*margin-right/.test(
			mytsaBundle.text
		),
		'标签页激活圆点仍存在右侧外边距'
	);
	ok(
		'标签工具栏下拉菜单配色与顶部下拉一致',
		/mytsa-tab-tool-dropdown/.test(tabPageModule.text) &&
			/\.mytsa-tab-tool-dropdown\{[^}]*background-color:color-mix\(in srgb,var\(--scheme-header\) 85%,transparent\)/.test(
				mytsaBundle.text
			) &&
			/\.mytsa-tab-tool-dropdown \.layui-menu\{[^}]*background-color:transparent/.test(
				mytsaBundle.text
			) &&
			/\.mytsa-tab-tool-dropdown \.layui-menu-body-title[^{]*\{[^}]*color:var\(--scheme-dropdown-text,#fff\)/.test(
				mytsaBundle.text
			) &&
			/\.mytsa-tab-tool-dropdown \.layui-menu li:hover[^{]*\{[^}]*background-color:var\(--global-selected-color\)!important/.test(
				mytsaBundle.text
			),
		'标签工具栏下拉菜单配色未与顶部下拉一致'
	);
	const adminBundle = await request(base, '/theme/admin/css/admin.bundle.css');
	const themeModule = await request(base, '/component/mytsa/module/theme.js');
	ok(
		'侧栏底部链接容器与侧栏同宽',
		/\.mytsa-admin \.layui-side-scroll\{[^}]*width:230px/.test(adminBundle.text) &&
			!/\.mytsa-admin \.layui-side-scroll\{[^}]*width:247px/.test(adminBundle.text),
		'侧栏滚动容器宽度与侧栏不一致'
	);
	ok(
		'侧边栏 GitHub 链接具备圆角 hover 背景',
		/\.mytsa-side-links a\{[^}]*height:32px[^}]*margin:7px 8px[^}]*border-radius:6px/.test(
			adminBundle.text
		) &&
			/\.mytsa-side-links a:hover\{background-color:var\(--scheme-hover-fill\)/.test(
				adminBundle.text
			),
		'侧边栏 GitHub 链接缺少圆角 hover 背景'
	);
	ok(
		'主题色阶 CSS 变量与写入逻辑均已构建',
		adminBundle.status === 200 &&
			themeModule.status === 200 &&
			/--global-selected-color/.test(adminBundle.text) &&
			/--global-tab-color/.test(adminBundle.text) &&
			/--global-header-color/.test(adminBundle.text) &&
			/--global-color-1/.test(adminBundle.text) &&
			/--global-selected-color/.test(themeModule.text) &&
			/--global-tab-color/.test(themeModule.text) &&
			/--global-header-color/.test(themeModule.text) &&
			/--global-color-/.test(themeModule.text),
		`CSS HTTP ${adminBundle.status} / JS HTTP ${themeModule.status}`
	);
	ok(
		'语义配色变量与 WCAG 对比度逻辑已构建',
		/--scheme-body-bg/.test(adminBundle.text) &&
			/--scheme-card-bg/.test(adminBundle.text) &&
			/--scheme-selected-text/.test(adminBundle.text) &&
			/\.2126/.test(themeModule.text) &&
			/--scheme-selected-text/.test(themeModule.text)
	);
	ok(
		'暗黑模式语义文字色按层级设置',
		/--scheme-text-muted/.test(adminBundle.text) &&
			/--scheme-dropdown-text/.test(adminBundle.text) &&
			/--scheme-subtle-fill/.test(adminBundle.text) &&
			/--scheme-hover-fill/.test(adminBundle.text) &&
			/rgba\(255,\s*255,\s*255,\s*0\.8\)/.test(themeModule.text) &&
			/rgba\(255,\s*255,\s*255,\s*0\.7\)/.test(themeModule.text) &&
			/rgba\(255,\s*255,\s*255,\s*0\.65\)/.test(themeModule.text) &&
			/rgba\(255,\s*255,\s*255,\s*0\.12\)/.test(themeModule.text) &&
			/rgba\(255,\s*255,\s*255,\s*0\.08\)/.test(themeModule.text),
		'暗黑语义文字或填充 token 缺失'
	);
	ok(
		'头部栏文字色支持主题色 headerText、方案配置与自动回退',
		configData.theme.schemes.every((scheme) =>
			/^#[0-9a-f]{6}$/i.test(scheme.headerText || '')
		) &&
			Array.isArray(configData.colors) &&
			configData.colors.every((color) => /^#[0-9a-f]{6}$/i.test(color.headerText || '')) &&
			/headerText/.test(themeModule.text) &&
			/--scheme-header-text/.test(themeModule.text) &&
			/color:var\(--scheme-header-text\)/.test(adminBundle.text),
		'headerText 配置、写入或样式消费缺失'
	);
	ok(
		'用户下拉菜单背景取顶栏色加透明度、无内边距且文字使用语义 token',
		/\.layui-layout-right \.layui-nav-child\{[^}]*padding:0/.test(adminBundle.text) &&
			/\.layui-nav-item\.user>\.layui-nav-child\{[^}]*background-color:color-mix\(in srgb,var\(--scheme-header\) 85%,transparent\)/.test(
				adminBundle.text
			) &&
			!/\.layui-nav-item\.user>\.layui-nav-child\{[^}]*--scheme-tab/.test(adminBundle.text) &&
			/\.layui-nav-item\.user>\.layui-nav-child hr\{border-bottom-color:var\(--scheme-hover-fill\)\}/.test(
				adminBundle.text
			) &&
			/\.layui-nav-item\.user>\.layui-nav-child dd>a\{color:var\(--scheme-dropdown-text,#fff\)\}/.test(
				adminBundle.text
			) &&
			/\.layui-nav-item\.user>\.layui-nav-child dd>a:hover[^{]*\{[^}]*background-color:var\(--global-selected-color\)/.test(
				adminBundle.text
			) &&
			/\.layui-nav-item\.user>\.layui-nav-child dd\.layui-this>a[^{]*\{[^}]*color:var\(--scheme-dropdown-text,#fff\)/.test(
				adminBundle.text
			),
		'用户下拉菜单背景或文字语义 token 缺失'
	);
	ok(
		'用户入口块、头像与文字尺寸已缩小且垂直居中',
		/\.layui-nav-item\.user>a\.user-entry\{[^}]*height:38px/.test(adminBundle.text) &&
			/\.layui-nav-item\.user>a\.user-entry\{[^}]*margin:11px 8px/.test(adminBundle.text) &&
			/\.layui-nav-item\.user>a\.user-entry\{[^}]*vertical-align:middle/.test(
				adminBundle.text
			) &&
			/\.layui-nav-item\.user \.user-avatar\{[^}]*width:28px/.test(adminBundle.text) &&
			/\.layui-nav-item\.user \.user-avatar\{[^}]*height:28px/.test(adminBundle.text) &&
			/\.layui-nav-item\.user \.user-name\{font-size:12px/.test(adminBundle.text) &&
			/\.layui-nav-item\.user \.user-group\{font-size:10px[^}]*color:var\(--scheme-text-muted\)/.test(
				adminBundle.text
			),
		'用户入口块、头像或文字尺寸未缩小'
	);
	ok(
		'顶栏设置图标具备常驻圆角背景且垂直居中',
		/\.layui-nav-item>a\.setting\{[^}]*height:32px/.test(adminBundle.text) &&
			/\.layui-nav-item>a\.setting\{[^}]*margin:14px 8px/.test(adminBundle.text) &&
			/\.layui-nav-item>a\.setting\{[^}]*vertical-align:middle/.test(adminBundle.text) &&
			/\.layui-nav-item>a\.setting\{[^}]*border-radius:6px[^}]*background-color:var\(--scheme-subtle-fill\)/.test(
				adminBundle.text
			) &&
			!/\.layui-nav-item>a\.setting:hover\{/.test(adminBundle.text),
		'设置图标背景未常驻、仍依赖 hover 或上下留白不正确'
	);
	ok(
		'顶栏右侧图标统一具备更深的 hover 背景',
		/\.layui-layout-right \.layui-nav-item>a:hover[^{]*\{[^}]*background-color:var\(--scheme-hover-fill\)/.test(
			adminBundle.text
		) &&
			/\.layui-nav-item\.user>a\.user-entry:hover\{[^}]*background-color:var\(--scheme-hover-fill\)/.test(
				adminBundle.text
			),
		'顶栏图标 hover 背景缺失或过轻'
	);
	ok(
		'顶栏左侧图标统一具备圆角 hover 背景且垂直居中',
		/\.layui-layout-left \.layui-nav-item>a[^{]*\{[^}]*border-radius:6px/.test(
			adminBundle.text
		) &&
			/\.layui-layout-left \.layui-nav-item>a[^{]*\{[^}]*vertical-align:middle/.test(
				adminBundle.text
			) &&
			/\.layui-layout-left \.layui-nav-item>a:hover[^{]*\{[^}]*background-color:var\(--scheme-hover-fill\)/.test(
				adminBundle.text
			),
		'顶栏左侧图标 hover 背景缺失或未垂直居中'
	);
	ok(
		'消息中心小红点使用显式右上角定位',
		/\.layui-layout-right \.layui-nav-item>a \.layui-badge-dot\{left:auto;right:3px;top:3px;margin:0\}/.test(
			adminBundle.text
		),
		'消息中心小红点未显式定位'
	);
	const iframeEntry = await request(base, '/component/iframe/iframe.js');
	const extendCss = await request(base, '/component/layui/css/extend.css');
	ok(
		'方案按 mode 拆分且 iframe 按作用域同步',
		iframeEntry.status === 200 &&
			configData.theme.schemes.every((scheme) => ['light', 'dark'].includes(scheme.mode)) &&
			configData.theme.schemes.some(
				(scheme) =>
					scheme.mode === 'dark' &&
					/^#[0-9a-f]{6}$/i.test(scheme.header || '') &&
					/^#[0-9a-f]{6}$/i.test(scheme.tab || '')
			) &&
			/theme-iframe-vars/.test(iframeEntry.text) &&
			/mytsa-theme/.test(iframeEntry.text) &&
			/addEventListener\(['"]message['"]/.test(iframeEntry.text) &&
			/reset/.test(iframeEntry.text) &&
			/accent/.test(themeModule.text) &&
			/full/.test(themeModule.text) &&
			/theme-iframe-vars/.test(themeModule.text) &&
			/postMessage/.test(themeModule.text) &&
			/watermark/.test(iframeEntry.text),
		`HTTP ${iframeEntry.status}`
	);
	ok(
		'iframe 暗黑模式由 Layui 风格 dark 类驱动',
		extendCss.status === 200 &&
			/:root\.dark/.test(extendCss.text) &&
			/--lay-color-bg-1/.test(extendCss.text) &&
			/--lay-color-text-1:\s*rgba\(255,\s*255,\s*255,\s*(?:0)?\.?8\)/.test(extendCss.text) &&
			/--lay-color-primary/.test(extendCss.text) &&
			/\.dark\s+\.layui-card/.test(extendCss.text) &&
			/classList\.add\(['"]dark['"]\)/.test(iframeEntry.text) &&
			/classList\.remove\(['"]dark['"]\)/.test(iframeEntry.text),
		`CSS HTTP ${extendCss.status} / JS HTTP ${iframeEntry.status}`
	);
	ok(
		'设置面板含方案选中色预览与栅格主题色预设',
		/scheme-preview-selected/.test(adminBundle.text) &&
			/palette-swatch/.test(adminBundle.text) &&
			/grid-template-columns:repeat\(3/.test(adminBundle.text) &&
			/scheme-preview-selected/.test(themeModule.text) &&
			/data-select-color/.test(themeModule.text) &&
			/theme-palette-areas/.test(themeModule.text) &&
			/theme-custom-headerText/.test(themeModule.text) &&
			/顶栏文字色/.test(themeModule.text)
	);
	ok(
		'主题色预设支持随机生成',
		/data-random-color/.test(themeModule.text) &&
			/palette-random/.test(themeModule.text) &&
			/Math\.random/.test(themeModule.text) &&
			/random-/.test(themeModule.text) &&
			/data-select-color/.test(themeModule.text),
		'主题色随机功能缺失'
	);
	ok(
		'配色方案一行两个展示',
		/grid-template-columns:repeat\(2/.test(adminBundle.text) &&
			/data-select-scheme/.test(themeModule.text) &&
			!/scheme-group-title/.test(themeModule.text)
	);

	const assets = [...new Set(pageSources.flatMap(({ page, html }) => collectAssets(html, page)))];
	for (const asset of assets) {
		const response = await request(base, asset.startsWith('/') ? asset : `/${asset}`);
		ok(`静态资源 ${asset}`, response.status === 200, `HTTP ${response.status}`);
	}
} finally {
	server.closeAllConnections?.();
	server.close();
}

if (errors.length > 0) {
	console.error(`\nE2E 失败 ${errors.length} 项：`);
	for (const error of errors) {
		console.error(`  - ${error}`);
	}
	process.exit(1);
}

console.log(`\nE2E 通过：${passed} 项检查`);
