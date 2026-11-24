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
			watermark: 'watermark',
		})
		.use(['watermark'], function () {
			layui.watermark.render();
		});
})();
