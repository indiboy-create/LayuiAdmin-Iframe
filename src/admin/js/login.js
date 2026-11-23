layui.use(['form'], function () {
	'use strict';

	var form = layui.form;

	form.on('submit(login)', function () {
		return false;
	});
});
