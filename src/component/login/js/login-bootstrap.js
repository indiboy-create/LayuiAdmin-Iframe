(function () {
	'use strict';

	// 原生提交由脚本接管：页面去掉 onsubmit 内联属性后，回车键也能直接登录
	var form = document.querySelector('form.layui-form');
	if (form) {
		form.addEventListener('submit', function (event) {
			event.preventDefault();
			var button = form.querySelector('[lay-submit]');
			if (button && !button.disabled) {
				button.click();
			}
		});
	}

	layui.use(['form', 'layer'], function () {
		'use strict';

		var form = layui.form;
		var layer = layui.layer;

		form.on('submit(login)', function (data) {
			var field = data.field || {};
			var button = data.elem;

			if (button) {
				button.disabled = true;
			}

			window.Auth.login(field.username, field.password, !!field['like1[write]'])
				.then(function () {
					window.location.href = 'index.html';
				})
				.catch(function (error) {
					if (button) {
						button.disabled = false;
					}

					var message = error && error.message ? error.message : '登录失败';
					var alert = document.getElementById('login-alert');
					if (alert) {
						alert.textContent = message;
					}

					var username = document.querySelector('input[name="username"]');
					var password = document.querySelector('input[name="password"]');
					if (username) {
						username.setAttribute('aria-invalid', 'true');
					}
					if (password) {
						password.setAttribute('aria-invalid', 'true');
					}

					layer.msg(message, {
						icon: 2,
						time: 2000,
					});
				});

			return false;
		});
	});
})();
