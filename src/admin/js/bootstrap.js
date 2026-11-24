(function () {
	'use strict';

	// 跳过导航链接：聚焦时显形（:focus 在窗口失焦场景不一定匹配，补一个类兜底）
	var skipLink = document.querySelector('.mytsa-skip-link');
	if (skipLink) {
		skipLink.addEventListener('focus', function () {
			skipLink.classList.add('is-focused');
		});
		skipLink.addEventListener('blur', function () {
			skipLink.classList.remove('is-focused');
		});
	}

	// 后台主框架初始化：脚本外置，页面不再含内联脚本，便于启用严格 CSP
	layui.use(['admin'], function () {
		'use strict';

		var admin = layui.admin;
		var current = window.Auth ? window.Auth.session() : null;

		if (current) {
			var nameEl = document.querySelector('.layui-header .layui-nav-right .user cite');
			if (nameEl) {
				nameEl.textContent = current.name;
			}
		}

		admin.setConfigurationPath('admin/config/mytsa.config.json');

		admin.render();

		admin.logout(function () {
			return new Promise(function (resolve) {
				window.Auth.logout();
				resolve(true);
			});
		});
	});
})();
