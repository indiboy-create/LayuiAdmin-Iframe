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

	// 后台主框架初始化：脚本外置，页面不再含内联脚本
	layui.use(['admin'], function () {
		'use strict';

		var admin = layui.admin;

		admin.setConfigurationPath('api/mytsa.config.json');

		admin.render();

		admin.logout(function () {
			window.location.href = 'login.html';
		});
	});
})();
