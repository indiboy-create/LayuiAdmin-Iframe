(function () {
	var rootPath = (function (src) {
		src = document.currentScript
			? document.currentScript.src
			: document.scripts[document.scripts.length - 1].src;
		return src.substring(0, src.lastIndexOf("/") + 1);
	})();

	layui.config({
		base: rootPath + "module/"
	}).extend({
		admin: "admin",

		tabPage: "tabPage",
		menu: "menu",

		tools: "tools",
		theme: "theme"
	}).use([], function () { });
})();