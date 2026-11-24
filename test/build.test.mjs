import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	stampMytsaBuild,
	stampHtmlAssets,
	stampConfiguration,
	stampMenuData,
	hashTree,
	withStamp,
} from '../scripts/lib/build/stamp.mjs';
import { stripDebugAssets } from '../scripts/lib/build/strip-debug.mjs';
import { bundleMytsaCss, bundleAdminCss } from '../scripts/lib/build/bundle-css.mjs';
import { replaceDirectory } from '../scripts/lib/build/replace.mjs';

async function createFixture() {
	const dir = await mkdtemp(join(tmpdir(), 'layuiadmin-build-'));
	await mkdir(join(dir, 'component', 'mytsa', 'module'), { recursive: true });
	await mkdir(join(dir, 'component', 'mytsa', 'css', 'module'), { recursive: true });
	await mkdir(join(dir, 'admin', 'js'), { recursive: true });
	await mkdir(join(dir, 'admin', 'css'), { recursive: true });
	await mkdir(join(dir, 'admin', 'config'), { recursive: true });
	await writeFile(
		join(dir, 'admin', 'config', 'mytsa.config.json'),
		JSON.stringify({ menu: { data: 'api/menu.json' } }, null, '\t'),
		'utf8'
	);

	await writeFile(
		join(dir, 'component', 'mytsa', 'mytsa.js'),
		'(function () {\n\tlayui.config({\n\t\tbase: "",\n\t\tversion: ""\n\t});\n})();\n',
		'utf8'
	);
	await writeFile(join(dir, 'component', 'mytsa', 'css', 'mytsa.css'), '.mytsa{}\n', 'utf8');
	await writeFile(
		join(dir, 'component', 'mytsa', 'css', 'module', 'menu.css'),
		'.menu{}\n',
		'utf8'
	);
	await writeFile(
		join(dir, 'component', 'mytsa', 'css', 'module', 'tabPage.css'),
		'.tab{}\n',
		'utf8'
	);
	await writeFile(join(dir, 'admin', 'js', 'debug.js'), 'window.adminDebug = {};\n', 'utf8');
	await writeFile(join(dir, 'admin', 'js', 'app.js'), 'window.app = 1;\n', 'utf8');
	await writeFile(join(dir, 'admin', 'css', 'admin.css'), '.admin{}\n', 'utf8');
	await writeFile(join(dir, 'admin', 'css', 'variables.css'), ':root{}\n', 'utf8');
	await writeFile(join(dir, 'admin', 'css', 'reset.css'), '.reset{}\n', 'utf8');
	await writeFile(
		join(dir, 'index.html'),
		[
			'<!doctype html>',
			'<html>',
			'<head>',
			'<link rel="stylesheet" href="component/mytsa/css/mytsa.css">',
			'<link rel="stylesheet" href="component/mytsa/css/module/menu.css">',
			'<link rel="stylesheet" href="component/mytsa/css/module/tabPage.css">',
			'<link rel="stylesheet" href="admin/css/admin.css">',
			'<link rel="stylesheet" href="admin/css/variables.css">',
			'<link rel="stylesheet" href="admin/css/reset.css">',
			'</head>',
			'<body>',
			'<script src="admin/js/debug.js"></script>',
			'<script src="admin/js/app.js"></script>',
			'<img src="admin/images/a.png">',
			'<a href="home.html">首页</a>',
			'</body>',
			'</html>',
			'',
		].join('\n'),
		'utf8'
	);

	return dir;
}

let fixtureDir = null;

afterEach(async () => {
	if (fixtureDir) {
		await rm(fixtureDir, { recursive: true, force: true });
		fixtureDir = null;
	}
});

describe('构建子步骤', () => {
	it('stampMytsaBuild 注入构建戳，占位符缺失时抛错', async () => {
		fixtureDir = await createFixture();
		const stamp = await stampMytsaBuild(fixtureDir);
		assert.ok(stamp);
		const content = await readFile(join(fixtureDir, 'component', 'mytsa', 'mytsa.js'), 'utf8');
		assert.match(content, new RegExp(`version: "${stamp}"`));

		await writeFile(
			join(fixtureDir, 'component', 'mytsa', 'mytsa.js'),
			'layui.config({});\n',
			'utf8'
		);
		await assert.rejects(() => stampMytsaBuild(fixtureDir), /未能.*注入构建标记/);
	});

	it('stampHtmlAssets 只给本地 link/script/img 追加 ?t=', async () => {
		fixtureDir = await createFixture();
		await stampHtmlAssets(fixtureDir, 'abc');
		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');

		assert.match(html, /mytsa\.css\?t=abc/);
		assert.match(html, /app\.js\?t=abc/);
		assert.match(html, /a\.png\?t=abc/);
		assert.doesNotMatch(html, /home\.html\?t=/);
	});

	it('hashTree 为每个文件生成独立哈希，HTML 按文件粒度加戳', async () => {
		fixtureDir = await createFixture();
		const hashes = await hashTree(fixtureDir);
		const cssHash = hashes.get('component/mytsa/css/mytsa.css');
		const appHash = hashes.get('admin/js/app.js');
		assert.match(cssHash, /^[0-9a-f]{10}$/);
		assert.match(appHash, /^[0-9a-f]{10}$/);
		assert.notEqual(cssHash, appHash);

		await stampHtmlAssets(fixtureDir, hashes);
		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');
		assert.match(html, new RegExp(`mytsa\\.css\\?t=${cssHash}`));
		assert.match(html, new RegExp(`app\\.js\\?t=${appHash}`));
	});

	it('stampMenuData 只给菜单中本地 html 的 href 追加 ?t=', async () => {
		fixtureDir = await createFixture();
		await mkdir(join(fixtureDir, 'api'), { recursive: true });
		await writeFile(
			join(fixtureDir, 'api', 'menu.json'),
			JSON.stringify(
				[
					{
						id: '1',
						title: '目录',
						type: 0,
						children: [{ id: '2', title: '首页', type: 1, href: 'home.html' }],
					},
					{ id: '3', title: '外链', type: 1, href: 'https://example.com/a.html' },
					{ id: '4', title: '接口', type: 1, href: 'api/data' },
				],
				null,
				'\t'
			),
			'utf8'
		);

		const stamped = await stampMenuData(fixtureDir, 'abc', 'api/menu.json');
		const menu = JSON.parse(await readFile(join(fixtureDir, 'api', 'menu.json'), 'utf8'));
		assert.equal(menu[0].children[0].href, 'home.html?t=abc');
		assert.equal(menu[1].href, 'https://example.com/a.html', '外链不应追加构建戳');
		assert.equal(menu[2].href, 'api/data', '非 html 地址不应追加构建戳');
		assert.equal(stamped, 1);

		await stampMenuData(fixtureDir, 'def', 'api/menu.json');
		const again = JSON.parse(await readFile(join(fixtureDir, 'api', 'menu.json'), 'utf8'));
		assert.equal(again[0].children[0].href, 'home.html?t=abc', '已带戳的地址不应重复追加');
	});

	it('stampConfiguration 只给本地静态菜单数据追加 ?t=', async () => {
		fixtureDir = await createFixture();
		const configPath = join(fixtureDir, 'admin', 'config', 'mytsa.config.json');

		await stampConfiguration(fixtureDir, 'abc');
		let config = JSON.parse(await readFile(configPath, 'utf8'));
		assert.equal(config.menu.data, 'api/menu.json?t=abc');

		config.menu.data = 'api/menu.json?t=abc';
		await writeFile(configPath, JSON.stringify(config), 'utf8');
		await stampConfiguration(fixtureDir, 'def');
		config = JSON.parse(await readFile(configPath, 'utf8'));
		assert.equal(config.menu.data, 'api/menu.json?t=abc', '已带戳的地址不应重复追加');

		config.menu.data = 'https://example.com/menu.json';
		await writeFile(configPath, JSON.stringify(config), 'utf8');
		await stampConfiguration(fixtureDir, 'ghi');
		config = JSON.parse(await readFile(configPath, 'utf8'));
		assert.equal(config.menu.data, 'https://example.com/menu.json', '外部接口应交给服务端缓存');
	});

	it('withStamp 只给本地资源加戳，外链/锚点/已带戳保持原样', () => {
		assert.equal(withStamp('admin/js/app.js', 'abc'), 'admin/js/app.js?t=abc');
		assert.equal(withStamp('admin/css/admin.css', 'abc'), 'admin/css/admin.css?t=abc');
		assert.equal(withStamp('admin/a.css?theme=dark', 'abc'), 'admin/a.css?theme=dark&t=abc');
		assert.equal(
			withStamp('https://cdn.example.com/a.js', 'abc'),
			'https://cdn.example.com/a.js'
		);
		assert.equal(withStamp('//cdn.example.com/a.js', 'abc'), '//cdn.example.com/a.js');
		assert.equal(withStamp('#anchor', 'abc'), '#anchor');
		assert.equal(withStamp('admin/js/app.js?t=old', 'abc'), 'admin/js/app.js?t=old');
		assert.equal(withStamp('admin/js/app.js?t=old&x=1', 'abc'), 'admin/js/app.js?t=old&x=1');
	});

	it('stripDebugAssets 删除 debug.js 与引用，保留其他脚本', async () => {
		fixtureDir = await createFixture();
		await stripDebugAssets(fixtureDir);

		await assert.rejects(
			() => readFile(join(fixtureDir, 'admin', 'js', 'debug.js'), 'utf8'),
			/ENOENT/
		);
		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');
		assert.doesNotMatch(html, /debug\.js/);
		assert.match(html, /app\.js/);
	});

	it('bundleMytsaCss 合并样式并改写 index.html', async () => {
		fixtureDir = await createFixture();
		await bundleMytsaCss(fixtureDir);

		const bundle = await readFile(
			join(fixtureDir, 'component', 'mytsa', 'css', 'mytsa.bundle.css'),
			'utf8'
		);
		assert.match(bundle, /\.menu\{\}/);
		assert.match(bundle, /\.tab\{\}/);
		assert.match(bundle, /\.mytsa\{\}/);

		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');
		assert.match(html, /mytsa\.bundle\.css/);
		assert.doesNotMatch(html, /module\/menu\.css/);

		// 模块样式合并后删除；mytsa.css 仍供登录页与子页使用，必须保留
		assert.ok(
			await readFile(join(fixtureDir, 'component', 'mytsa', 'css', 'mytsa.css'), 'utf8')
		);
		await assert.rejects(
			() =>
				readFile(
					join(fixtureDir, 'component', 'mytsa', 'css', 'module', 'menu.css'),
					'utf8'
				),
			/ENOENT/
		);
		await assert.rejects(
			() =>
				readFile(
					join(fixtureDir, 'component', 'mytsa', 'css', 'module', 'tabPage.css'),
					'utf8'
				),
			/ENOENT/
		);
	});

	it('bundleAdminCss 合并项目样式、删除冗余源文件并改写 index.html', async () => {
		fixtureDir = await createFixture();
		await bundleAdminCss(fixtureDir);

		const bundle = await readFile(join(fixtureDir, 'admin', 'css', 'admin.bundle.css'), 'utf8');
		assert.match(bundle, /\.admin\{\}/);
		assert.match(bundle, /:root\{\}/);
		assert.match(bundle, /\.reset\{\}/);

		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');
		assert.match(html, /admin\/css\/admin\.bundle\.css/);
		assert.doesNotMatch(html, /admin\/css\/admin\.css"/);
		assert.doesNotMatch(html, /variables\.css/);
		assert.doesNotMatch(html, /reset\.css/);

		// variables.css 仍供登录页使用，必须保留
		assert.ok(await readFile(join(fixtureDir, 'admin', 'css', 'variables.css'), 'utf8'));
		await assert.rejects(() => readFile(join(fixtureDir, 'admin', 'css', 'admin.css'), 'utf8'));
		await assert.rejects(() => readFile(join(fixtureDir, 'admin', 'css', 'reset.css'), 'utf8'));
	});

	it('replaceDirectory 备份替换已有产物并清理临时目录', async () => {
		fixtureDir = await mkdtemp(join(tmpdir(), 'layuiadmin-replace-'));
		const staging = join(fixtureDir, 'dist.tmp');
		const target = join(fixtureDir, 'dist');
		await mkdir(staging, { recursive: true });
		await writeFile(join(staging, 'new.txt'), 'new', 'utf8');
		await mkdir(target, { recursive: true });
		await writeFile(join(target, 'old.txt'), 'old', 'utf8');

		await replaceDirectory(staging, target);

		assert.equal(await readFile(join(target, 'new.txt'), 'utf8'), 'new');
		await assert.rejects(() => readFile(join(target, 'old.txt'), 'utf8'), /ENOENT/);
		assert.deepEqual(await readdir(fixtureDir), ['dist'], '临时目录与备份都应被清理');
	});

	it('replaceDirectory 在目标目录不存在时直接就位', async () => {
		fixtureDir = await mkdtemp(join(tmpdir(), 'layuiadmin-replace-'));
		const staging = join(fixtureDir, 'dist.tmp');
		await mkdir(staging, { recursive: true });
		await writeFile(join(staging, 'new.txt'), 'new', 'utf8');

		await replaceDirectory(staging, join(fixtureDir, 'dist'));

		assert.equal(await readFile(join(fixtureDir, 'dist', 'new.txt'), 'utf8'), 'new');
		assert.deepEqual(await readdir(fixtureDir), ['dist']);
	});
});
