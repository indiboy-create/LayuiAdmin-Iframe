(function () {
	var themeMeta = document.querySelector('meta[name="theme-color"]');
	var schemeMeta = document.querySelector('meta[name="color-scheme"]');
	var defaultThemeColor = themeMeta ? themeMeta.getAttribute('content') : '';
	var defaultScheme = schemeMeta ? schemeMeta.getAttribute('content') : '';

	// 嵌入主框架时背景透明，透出 panel 的皮肤背景
	if (window.self !== window.top) {
		document.documentElement.classList.add('mytsa-embedded');
	}

	function applyThemeVars(data) {
		if (!data || typeof data !== 'object') {
			return;
		}
		var root = document.documentElement;
		var style = root.style;
		if (data.reset) {
			root.classList.remove('dark');
			(data.names || []).forEach(function (name) {
				style.removeProperty(name);
			});
			if (themeMeta && defaultThemeColor) {
				themeMeta.setAttribute('content', defaultThemeColor);
			}
			if (schemeMeta && defaultScheme) {
				schemeMeta.setAttribute('content', defaultScheme);
			}
			return;
		}
		if (data.mode === 'dark') {
			root.classList.add('dark');
		}
		if (!data.vars || typeof data.vars !== 'object') {
			return;
		}
		Object.keys(data.vars).forEach(function (name) {
			if (/^--[a-z0-9-]+$/i.test(name)) {
				style.setProperty(name, data.vars[name]);
			}
		});
		if (data.mode === 'dark') {
			if (themeMeta) {
				themeMeta.setAttribute('content', '#17171a');
			}
			if (schemeMeta) {
				schemeMeta.setAttribute('content', 'dark');
			}
		}
	}

	// 皮肤透明度独立于主题配色，嵌入时直接读取父文档变量，保证首屏一致
	function syncSkinFromParent() {
		try {
			if (window.parent && window.parent !== window && window.parent.document) {
				var value =
					window.parent.document.documentElement.style.getPropertyValue('--skin-alpha');
				if (value) {
					document.documentElement.style.setProperty('--skin-alpha', value);
				}
			}
		} catch (error) {
			// 跨域时忽略
		}
	}

	// 站点标识随父页面下发的 mytsa_scope 参数传递，子页据此读取本站点的主题缓存
	function getThemeScope() {
		try {
			var match = /[?&]mytsa_scope=([^&]*)/.exec(window.location.search || '');
			return match ? decodeURIComponent(match[1]) : '';
		} catch (error) {
			return '';
		}
	}

	var themeScope = getThemeScope();
	var themeStoragePrefix = themeScope ? 'mytsa:' + themeScope + ':' : '';

	syncSkinFromParent();

	try {
		var stored = window.localStorage.getItem(themeStoragePrefix + 'theme-iframe-vars');
		if (stored) {
			applyThemeVars(JSON.parse(stored));
		}
	} catch (error) {
		// 存储不可用时保留页面默认配色
	}

	window.addEventListener('message', function (event) {
		// 只接受同源页面推送，避免其他站点 iframe 的消息串入
		if (event.origin && event.origin !== window.location.origin) {
			return;
		}
		if (event.data && event.data.type === 'mytsa-theme') {
			applyThemeVars(event.data);
		}
	});

	var rootPath = (function (src) {
		src = document.currentScript
			? document.currentScript.src
			: document.scripts[document.scripts.length - 1].src;
		return src.substring(0, src.lastIndexOf('/') + 1);
	})();

	layui
		.config({
			version: '',
		})
		.extend({
			watermark: '{/}' + rootPath + 'module/watermark',
		})
		.use(['watermark'], function () {
			// 默认不执行：只有页面中存在 .watermark 容器时才绘制
			if (document.querySelector('.watermark')) {
				layui.watermark.render();
			}
		});
})();
