import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stampPearBuild, stampHtmlAssets } from '../scripts/lib/build/stamp.mjs';
import { stripDebugAssets } from '../scripts/lib/build/strip-debug.mjs';
import { bundlePearCss } from '../scripts/lib/build/bundle-css.mjs';

async function createFixture() {
	const dir = await mkdtemp(join(tmpdir(), 'layuiadmin-build-'));
	await mkdir(join(dir, 'component', 'pear', 'module'), { recursive: true });
	await mkdir(join(dir, 'component', 'pear', 'css', 'module'), { recursive: true });
	await mkdir(join(dir, 'admin', 'js'), { recursive: true });

	await writeFile(
		join(dir, 'component', 'pear', 'pear.js'),
		'(function () {\n\tlayui.config({\n\t\tbase: "",\n\t\tversion: ""\n\t});\n})();\n',
		'utf8'
	);
	await writeFile(join(dir, 'component', 'pear', 'css', 'pear.css'), '.pear{}\n', 'utf8');
	await writeFile(
		join(dir, 'component', 'pear', 'css', 'module', 'menu.css'),
		'.menu{}\n',
		'utf8'
	);
	await writeFile(
		join(dir, 'component', 'pear', 'css', 'module', 'tabPage.css'),
		'.tab{}\n',
		'utf8'
	);
	await writeFile(join(dir, 'admin', 'js', 'debug.js'), 'window.adminDebug = {};\n', 'utf8');
	await writeFile(join(dir, 'admin', 'js', 'app.js'), 'window.app = 1;\n', 'utf8');
	await writeFile(
		join(dir, 'index.html'),
		[
			'<!doctype html>',
			'<html>',
			'<head>',
			'<link rel="stylesheet" href="component/pear/css/pear.css">',
			'<link rel="stylesheet" href="component/pear/css/module/menu.css">',
			'<link rel="stylesheet" href="component/pear/css/module/tabPage.css">',
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
	it('stampPearBuild 注入构建戳，占位符缺失时抛错', async () => {
		fixtureDir = await createFixture();
		const stamp = await stampPearBuild(fixtureDir);
		assert.ok(stamp);
		const content = await readFile(join(fixtureDir, 'component', 'pear', 'pear.js'), 'utf8');
		assert.match(content, new RegExp(`version: "${stamp}"`));

		await writeFile(
			join(fixtureDir, 'component', 'pear', 'pear.js'),
			'layui.config({});\n',
			'utf8'
		);
		await assert.rejects(() => stampPearBuild(fixtureDir), /未能.*注入构建标记/);
	});

	it('stampHtmlAssets 只给本地 link/script/img 追加 ?t=', async () => {
		fixtureDir = await createFixture();
		await stampHtmlAssets(fixtureDir, 'abc');
		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');

		assert.match(html, /pear\.css\?t=abc/);
		assert.match(html, /app\.js\?t=abc/);
		assert.match(html, /a\.png\?t=abc/);
		assert.doesNotMatch(html, /home\.html\?t=/);
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

	it('bundlePearCss 合并样式并改写 index.html', async () => {
		fixtureDir = await createFixture();
		await bundlePearCss(fixtureDir);

		const bundle = await readFile(
			join(fixtureDir, 'component', 'pear', 'css', 'pear.bundle.css'),
			'utf8'
		);
		assert.match(bundle, /\.menu\{\}/);
		assert.match(bundle, /\.tab\{\}/);
		assert.match(bundle, /\.pear\{\}/);

		const html = await readFile(join(fixtureDir, 'index.html'), 'utf8');
		assert.match(html, /pear\.bundle\.css/);
		assert.doesNotMatch(html, /module\/menu\.css/);
	});
});
