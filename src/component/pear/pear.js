window.rootPath = (function (src) {
	src = document.currentScript
		? document.currentScript.src
		: document.scripts[document.scripts.length - 1].src;
	return src.substring(0, src.lastIndexOf("/") + 1);
})();

layui.config({
	base: rootPath + "module/",
	version: "4.0.3"
}).extend({
	admin: "admin",
	page: "page",
	tabPage: "tabPage",
	menu: "menu",
	fullscreen: "fullscreen",
	tools: "tools"
}).use([], function () { });