layui.use(['jquery'], function () {
	'use strict';

	var $ = layui.jquery;

	function openTab(id, url, title) {
		var topWindow = window.parent;
		var topAdmin = topWindow && topWindow.layui && topWindow.layui.admin;

		if (topAdmin && topAdmin.instances && topAdmin.instances.tabPage) {
			topAdmin.instances.tabPage.changePage({
				id: id,
				url: url,
				title: title,
				close: true,
			});
			if (topAdmin.instances.menu) {
				topAdmin.instances.menu.selectItem(id);
			}
			return;
		}

		window.location.href = url;
	}

	$(document).on('click', '[data-tab-url]', function () {
		var $button = $(this);
		openTab(
			$button.attr('data-tab-id'),
			$button.attr('data-tab-url'),
			$button.attr('data-tab-title')
		);
		return false;
	});
});
