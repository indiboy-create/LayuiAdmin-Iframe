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

function collectAssets(html) {
	return [
		...new Set(
			[...html.matchAll(/(?:href|src)="([^"]+)"/g)]
				.map((match) => match[1])
				.filter((url) => url && !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url))
				.map((url) => url.split('?')[0].split('#')[0])
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
	ok('index.html 引入鉴权脚本', index.text.includes('admin/js/auth.js'));
	ok('index.html 首屏前拦截未登录', index.text.includes('Auth.guard()'));

	const login = await request(base, '/login.html');
	ok('login.html 可访问', login.status === 200, `HTTP ${login.status}`);
	ok('login.html 调用 Auth.login', login.text.includes('Auth.login'));

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

	const config = await request(base, '/admin/config/pear.config.json');
	ok('pear.config.json 可访问', config.status === 200, `HTTP ${config.status}`);
	const configData = parseJson('pear.config.json', config.text);
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

	const assets = [...new Set([...collectAssets(index.text), ...collectAssets(login.text)])];
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
