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
	ok('index.html 引入鉴权脚本', index.text.includes('theme/admin/js/auth.js'));
	ok('index.html 首屏前拦截未登录', /data-guard\b/.test(index.text));
	ok('index.html 声明 noindex', /<meta\s+name="robots"[^>]*noindex/i.test(index.text));
	ok(
		'index.html 无内联脚本',
		!/<script(?![^>]*\bsrc=)[^>]*>/i.test(index.text),
		'页面应只引用外置脚本'
	);
	ok(
		'index.html 声明 referrer no-referrer',
		/<meta\s+name="referrer"[^>]*no-referrer/i.test(index.text)
	);
	ok('index.html 引入水印脚本', index.text.includes('theme/admin/js/watermark.js'));
	ok('index.html 与登录资源隔离', !/(?:theme\/login|component\/login)\//.test(index.text));

	const watermark = await request(base, '/theme/admin/js/watermark.js');
	ok(
		'watermark.js 只在顶层窗口绘制',
		watermark.status === 200 && /window\.top\s*(?:===|!==)\s*window\.self/.test(watermark.text),
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
	ok('login.html 无内联脚本', !/<script(?![^>]*\bsrc=)[^>]*>/i.test(login.text));
	ok(
		'login.html 声明 referrer no-referrer',
		/<meta\s+name="referrer"[^>]*no-referrer/i.test(login.text)
	);
	ok('login.html 与后台资源隔离', !/(?:theme\/admin|component\/mytsa)\//.test(login.text));

	const loginBootstrap = await request(base, '/component/login/js/login-bootstrap.js');
	ok(
		'login-bootstrap.js 接管登录提交',
		loginBootstrap.status === 200 && loginBootstrap.text.includes('Auth.login'),
		`HTTP ${loginBootstrap.status}`
	);

	const auth = await request(base, '/api/auth.json');
	ok('api/auth.json 可访问', auth.status === 200, `HTTP ${auth.status}`);
	const authData = parseJson('api/auth.json', auth.text);
	ok(
		'api/auth.json 含可用账号',
		Boolean(authData && Array.isArray(authData.users) && authData.users.length > 0),
		'users 必须是非空数组'
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

	const pages = [
		'/index.html',
		'/login.html',
		'/theme/iframe/home.html',
		'/theme/iframe/workbench.html',
		'/theme/iframe/table.html',
		'/theme/iframe/layui.html',
	];
	const pageSources = [
		{ page: '/index.html', html: index.text },
		{ page: '/login.html', html: login.text },
	];

	for (const page of pages.slice(2)) {
		const response = await request(base, page);
		ok(`${page} 可访问`, response.status === 200, `HTTP ${response.status}`);
		ok(`${page} 声明 noindex`, /<meta\s+name="robots"[^>]*noindex/i.test(response.text));
		ok(
			`${page} 无内联脚本`,
			!/<script(?![^>]*\bsrc=)[^>]*>/i.test(response.text),
			'页面应只引用外置脚本'
		);
		ok(
			`${page} 声明 referrer no-referrer`,
			/<meta\s+name="referrer"[^>]*no-referrer/i.test(response.text)
		);
		ok(
			`${page} 与后台/登录资源隔离`,
			!/(?:theme\/admin|component\/mytsa|component\/login|theme\/login)\//.test(response.text)
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
