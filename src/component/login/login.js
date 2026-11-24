(function () {
	var rootPath = (function (src) {
		src = document.currentScript
			? document.currentScript.src
			: document.scripts[document.scripts.length - 1].src;
		return src.substring(0, src.lastIndexOf('/') + 1);
	})();

	layui
		.config({
			base: rootPath + 'module/',
			version: '',
		})
		.extend({
			loginGuard: 'loginGuard',
			auth: 'auth',
			loginBootstrap: 'loginBootstrap',
		})
		.use(['loginGuard', 'auth', 'loginBootstrap'], function () {});
})();
