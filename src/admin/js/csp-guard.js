(function () {
	'use strict';

	// 严格 CSP 下，href="javascript:..." 会被浏览器判为内联脚本并拦截；
	// 在捕获阶段取消默认行为即可消除报错，组件自身的 click 处理器不受影响。
	document.addEventListener(
		'click',
		function (event) {
			var link =
				event.target && event.target.closest ? event.target.closest('a[href]') : null;
			if (link && /^\s*javascript:/i.test(link.getAttribute('href') || '')) {
				event.preventDefault();
			}
		},
		true
	);
})();
