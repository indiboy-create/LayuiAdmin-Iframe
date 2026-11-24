layui.define(function (exports) {
	'use strict';

	var MOD_NAME = 'sanitize';

	// 统一的转义与地址清洗，避免 menu / tabPage / admin 各维护一份实现
	function escapeHtml(value) {
		return String(value === undefined || value === null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// iframe 地址：拦掉 javascript / vbscript 伪协议，防止直接执行脚本
	function safeUrl(value) {
		var url = String(value === undefined || value === null ? '' : value).trim();
		// 必须匹配控制字符与空白，用于防止 scheme 被空白或控制字符混淆
		// eslint-disable-next-line no-control-regex
		if (/^(?:javascript|vbscript):/i.test(url.replace(/[\u0000-\u0020]/g, ''))) {
			return 'about:blank';
		}
		return url;
	}

	// 菜单链接：空地址与可执行协议统一降级为无副作用的 javascript:;，并转义
	function safeHref(value) {
		var url = String(value === undefined || value === null ? '' : value).trim();
		if (!url || /^(?:javascript|data|vbscript):/i.test(url)) {
			return 'javascript:;';
		}
		return escapeHtml(url);
	}

	// iframe 是否加载到空白内容：同源可读时判断正文是否为空，跨域读取失败按“非空”处理
	function isFrameBlank(frame) {
		try {
			var doc = frame && frame.contentDocument;
			return !doc || !doc.body || doc.body.textContent.trim() === '';
		} catch (error) {
			return false;
		}
	}

	// 菜单请求失败时面向用户的提示文案
	function requestErrorMessage(xhr, status) {
		if (status === 'timeout') {
			return '菜单加载失败（请求超时）';
		}
		if (status === 'parsererror') {
			return '菜单加载失败（返回内容不是有效的 JSON）';
		}
		var code = xhr && xhr.status;
		if (!code) {
			return '菜单加载失败（网络不可达）';
		}
		return '菜单加载失败（HTTP ' + code + '）';
	}

	exports(MOD_NAME, {
		escapeHtml: escapeHtml,
		safeUrl: safeUrl,
		safeHref: safeHref,
		isFrameBlank: isFrameBlank,
		requestErrorMessage: requestErrorMessage,
	});
});
