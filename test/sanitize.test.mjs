import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const moduleDir = resolve(__dirname, '..', 'src', 'component', 'mytsa', 'module');
const sanitizePath = resolve(moduleDir, 'sanitize.js');

// layui 模块以 layui.define + exports(name, value) 导出，这里用一个最小桩加载
async function loadSanitize() {
	const code = await readFile(sanitizePath, 'utf8');
	let api = null;
	const sandbox = {
		layui: {
			define(factory) {
				factory((name, value) => {
					api = value;
				});
			},
		},
	};
	vm.runInNewContext(code, sandbox, { filename: sanitizePath });
	assert.ok(api, 'sanitize 模块未导出任何内容');
	return api;
}

describe('sanitize 纯函数', () => {
	it('escapeHtml 转义五个 HTML 敏感字符', async () => {
		const { escapeHtml } = await loadSanitize();
		assert.equal(
			escapeHtml(`<a href="x">'&'</a>`),
			'&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
		);
		assert.equal(escapeHtml(null), '');
		assert.equal(escapeHtml(undefined), '');
		assert.equal(escapeHtml(0), '0');
	});

	it('safeUrl 拦截可执行伪协议并把空白/控制字符变体一并拦下', async () => {
		const { safeUrl } = await loadSanitize();
		assert.equal(safeUrl('home.html'), 'home.html');
		assert.equal(safeUrl(' https://example.com/a '), 'https://example.com/a');
		assert.equal(safeUrl('javascript:alert(1)'), 'about:blank');
		assert.equal(safeUrl(' JaVaScRiPt:alert(1)'), 'about:blank');
		assert.equal(safeUrl('\u0000javascript:alert(1)'), 'about:blank');
		assert.equal(safeUrl('vbscript:msgbox(1)'), 'about:blank');
		assert.equal(safeUrl('java\nscript:alert(1)'), 'about:blank');
		assert.equal(safeUrl(''), '');
		assert.equal(safeUrl(undefined), '');
	});

	it('safeHref 对空地址与可执行协议降级并完成转义', async () => {
		const { safeHref } = await loadSanitize();
		assert.equal(safeHref(''), 'javascript:;');
		assert.equal(safeHref('javascript:alert(1)'), 'javascript:;');
		assert.equal(safeHref('data:text/html,<script>'), 'javascript:;');
		assert.equal(safeHref('vbscript:x'), 'javascript:;');
		assert.equal(safeHref('home.html'), 'home.html');
		assert.equal(safeHref('a?b=1&c=2'), 'a?b=1&amp;c=2');
	});

	it('isFrameBlank 判定空正文、缺失文档与跨域异常', async () => {
		const { isFrameBlank } = await loadSanitize();
		assert.equal(isFrameBlank(null), true);
		assert.equal(isFrameBlank({ contentDocument: null }), true);
		assert.equal(isFrameBlank({ contentDocument: { body: null } }), true);
		assert.equal(isFrameBlank({ contentDocument: { body: { textContent: '   ' } } }), true);
		assert.equal(isFrameBlank({ contentDocument: { body: { textContent: '内容' } } }), false);
		assert.equal(
			isFrameBlank({
				get contentDocument() {
					throw new Error('cross-origin');
				},
			}),
			false
		);
	});

	it('requestErrorMessage 覆盖超时、解析失败、网络不可达与 HTTP 状态', async () => {
		const { requestErrorMessage } = await loadSanitize();
		assert.equal(requestErrorMessage({}, 'timeout'), '菜单加载失败（请求超时）');
		assert.equal(
			requestErrorMessage({}, 'parsererror'),
			'菜单加载失败（返回内容不是有效的 JSON）'
		);
		assert.equal(requestErrorMessage({ status: 0 }, 'error'), '菜单加载失败（网络不可达）');
		assert.equal(requestErrorMessage(null, 'error'), '菜单加载失败（网络不可达）');
		assert.equal(requestErrorMessage({ status: 503 }, 'error'), '菜单加载失败（HTTP 503）');
	});

	it('menu / tabPage 复用 sanitize，不再各自维护副本', async () => {
		for (const name of ['menu.js', 'tabPage.js']) {
			const source = await readFile(resolve(moduleDir, name), 'utf8');
			assert.match(source, /'sanitize'/, `${name} 未声明 sanitize 依赖`);
			assert.doesNotMatch(source, /function escapeHtml\(/, `${name} 仍保留 escapeHtml 副本`);
		}
	});
});
