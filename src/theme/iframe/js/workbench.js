layui.use(['jquery'], function () {
	'use strict';

	var $ = layui.jquery;

	// data-tab-url 以当前 iframe 页面为基准；交给父框架时换成顶层相对地址
	function toTopUrl(url) {
		if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|theme\/iframe\/)/i.test(url)) {
			return url;
		}
		return 'theme/iframe/' + url;
	}

	function openTab(id, url, title) {
		var topWindow = window.parent;
		var topAdmin = topWindow && topWindow.layui && topWindow.layui.admin;

		if (topAdmin && topAdmin.instances && topAdmin.instances.tabPage) {
			topAdmin.instances.tabPage.changePage({
				id: id,
				url: toTopUrl(url),
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
