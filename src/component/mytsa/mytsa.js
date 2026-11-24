(function () {
	var rootPath = (function (src) {
		src = document.currentScript
			? document.currentScript.src
			: document.scripts[document.scripts.length - 1].src;
		return src.substring(0, src.lastIndexOf('/') + 1);
	})();

	// 样式由组件入口按 layui 约定注入，页面无需直接引入
	layui.link([
		rootPath + 'css/mytsa.css',
		rootPath + 'css/module/menu.css',
		rootPath + 'css/module/tabPage.css',
	]);

	layui
		.config({
			base: rootPath + 'module/',
			version: '',
		})
		.extend({
			admin: 'admin',

			tabPage: 'tabPage',
			menu: 'menu',
			sanitize: 'sanitize',

			tools: 'tools',
			theme: 'theme',
		});
})();
