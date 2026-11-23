layui.use(['admin'], function () {
	'use strict';

	var admin = layui.admin;

	admin.setConfigurationPath('admin/config/pear.config.json');

	admin.render();

	admin.logout(function () {
		return new Promise((resolve) => {
			resolve(true);
		});
	});
});
