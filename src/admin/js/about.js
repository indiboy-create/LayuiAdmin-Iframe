layui.use(['jquery', 'layer', 'admin'], function () {
	'use strict';

	var $ = layui.jquery;
	var layer = layui.layer;
	var admin = layui.admin;

	function safeLink(url) {
		return /^https?:\/\//i.test(url) ? url : '';
	}

	function readLinks() {
		var configuration = admin.getConfiguration() || {};
		var links = (configuration.other && configuration.other.links) || {};
		return {
			repository: safeLink(links.repository),
			preview: safeLink(links.preview),
		};
	}

	$(document).on('click', '.about-us', function () {
		var links = readLinks();
		var content =
			'<div style="padding: 20px 22px; line-height: 1.9; color: #666;">' +
			'<h2 style="margin-bottom: 8px; color: #333;">LayuiAdmin-Iframe</h2>' +
			'<p>基于 layui 的 iframe 版后台管理模板，支持多标签页、配色方案与自定义主题。</p>' +
			'<p>技术栈：layui 2.13、jQuery、Vite。</p>';

		if (links.repository) {
			content +=
				'<p><a href="' +
				links.repository +
				'" target="_blank" rel="noopener" class="layui-font-blue">GitHub 仓库</a></p>';
		}
		if (links.preview) {
			content +=
				'<p><a href="' +
				links.preview +
				'" target="_blank" rel="noopener" class="layui-font-blue">在线预览</a></p>';
		}
		content += '</div>';

		layer.open({
			type: 1,
			title: '关于我们',
			area: ['420px', 'auto'],
			shadeClose: true,
			content: content,
		});
	});
});
