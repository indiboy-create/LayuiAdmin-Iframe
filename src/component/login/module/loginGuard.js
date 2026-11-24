layui.define(function (exports) {
	'use strict';

	try {
		if (window.self !== window.top) {
			window.top.location.reload();
		}
	} catch (error) {
		// 跨域顶层窗口不可访问时忽略
	}

	exports('loginGuard', {});
});
