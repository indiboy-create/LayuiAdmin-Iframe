import { readFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	exists,
	walk,
	findMissingReferences,
	validateThemeConfig,
	collectLeafMenus,
} from '../scripts/lib/validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '..', 'src');

async function readJson(relPath) {
	return JSON.parse(await readFile(join(src, relPath), 'utf8'));
}

describe('菜单数据', () => {
	it('menu.json 中 id 全为字符串且唯一', async () => {
		const menu = await readJson('api/menu.json');
		const ids = [];
		const collect = (items) => {
			for (const item of items) {
				ids.push(item.id);
				if (item.children) collect(item.children);
			}
		};
		collect(menu);

		for (const id of ids) {
			assert.equal(typeof id, 'string', `菜单 id 类型错误：${JSON.stringify(id)}`);
		}
		assert.equal(new Set(ids).size, ids.length, '存在重复的菜单 id');
	});

	it('叶子菜单字段完整且指向存在的页面', async () => {
		const menu = await readJson('api/menu.json');
		const leaves = collectLeafMenus(menu);
		assert.ok(leaves.length > 0, '未找到叶子菜单');

		for (const leaf of leaves) {
			assert.ok(leaf.title, `菜单缺少 title：${leaf.id}`);
			assert.ok(leaf.icon, `菜单缺少 icon：${leaf.id}`);
			assert.ok(leaf.href, `菜单缺少 href：${leaf.id}`);
			assert.ok(
				['_iframe', '_layer', '_blank'].includes(leaf.openType),
				`菜单 openType 非法：${leaf.id} -> ${leaf.openType}`
			);
			assert.ok(await exists(join(src, leaf.href)), `菜单指向的页面不存在：${leaf.href}`);
		}
	});

	it('菜单至少指向 3 个不同页面', async () => {
		const menu = await readJson('api/menu.json');
		const targets = new Set(collectLeafMenus(menu).map((leaf) => leaf.href));
		assert.ok(targets.size >= 3, `菜单只指向 ${targets.size} 个页面，示例覆盖不足`);
	});
});

describe('主题配置', () => {
	it('结构合法且主键、label 唯一', async () => {
		const config = await readJson('admin/config/pear.config.json');
		const errors = [];
		validateThemeConfig(config, 'admin/config/pear.config.json', errors);
		assert.deepEqual(errors, [], errors.join('\n'));
	});

	it('首页标签指向存在的页面', async () => {
		const config = await readJson('admin/config/pear.config.json');
		assert.ok(
			await exists(join(src, config.tab.index.href)),
			`tab.index.href 不存在：${config.tab.index.href}`
		);
	});
});

describe('HTML 页面', () => {
	it('页面具备 doctype、lang、title 与 viewport', async () => {
		const files = (await walk(src)).filter((file) => extname(file) === '.html');
		assert.ok(files.length > 0, '未找到 HTML 页面');

		for (const file of files) {
			const html = await readFile(file, 'utf8');
			const shown = relative(src, file).replace(/\\/g, '/');
			assert.match(html, /<!doctype html>/i, `${shown} 缺少 doctype`);
			assert.match(html, /<html[^>]+lang=/i, `${shown} 缺少 lang`);
			assert.match(html, /<title>[^<]+<\/title>/i, `${shown} 缺少 title`);
			assert.match(html, /name="viewport"/i, `${shown} 缺少 viewport`);
		}
	});

	it('页面静态引用的资源都存在', async () => {
		const files = (await walk(src)).filter((file) => extname(file) === '.html');
		const errors = await findMissingReferences({ rootDir: src, files, kind: 'html' });
		assert.deepEqual(errors, [], errors.join('\n'));
	});
});
