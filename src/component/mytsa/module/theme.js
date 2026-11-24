layui.define(['jquery', 'form', 'layer', 'colorpicker'], function (exports) {
	'use strict';

	var MOD_NAME = 'theme';

	var $ = layui.jquery,
		form = layui.form,
		layer = layui.layer,
		colorpicker = layui.colorpicker;

	var config = null;

	var body = $('body');

	// 存储可能在隐私模式、禁用 Cookie 或配额不足时抛异常，统一包一层避免中断主题渲染
	function readStorage(key) {
		try {
			return window.localStorage.getItem(key);
		} catch (error) {
			return null;
		}
	}

	function writeStorage(key, value) {
		try {
			window.localStorage.setItem(key, value);
		} catch (error) {
			// 存储不可用时忽略，主题仅在本次会话生效
		}
	}

	function removeStorage(key) {
		try {
			window.localStorage.removeItem(key);
		} catch (error) {
			// 忽略
		}
	}

	function getItemById(list, id) {
		var result = null;
		$.each(list || [], function (i, item) {
			if (String(item.id) === String(id)) {
				result = item;
			}
		});
		return result;
	}

	var DEFAULT_SIDE = '#20222A';
	var DEFAULT_HEADER = '#FFFFFF';

	function normalizeScheme(scheme) {
		var base = scheme.base || scheme.side || DEFAULT_SIDE;
		return {
			id: scheme.id,
			label: scheme.label,
			side: base,
			header: scheme.header || DEFAULT_HEADER,
			logo: scheme.logo || base,
		};
	}

	function getSchemeList() {
		var list = config && config.theme && config.theme.schemes;
		return list && list.length
			? list.map(normalizeScheme)
			: [normalizeScheme({ id: 'default', label: 'default' })];
	}

	function resolveScheme(option) {
		var schemes = getSchemeList();
		var fallback = getItemById(schemes, option.theme.defaultScheme) || schemes[0];
		if (option.theme.allowCustom === false) {
			return fallback;
		}
		return getItemById(schemes, readStorage('theme-scheme')) || fallback;
	}

	function getColorById(id) {
		var color = getItemById(config.colors, id);
		if (color && config.theme.allowCustom !== false) {
			return color;
		}
		var fallback = getItemById(config.colors, config.theme.defaultColor);
		return fallback || config.colors[0];
	}

	function isLightColor(color) {
		var hex = String(color || '').replace('#', '');
		if (hex.length === 3) {
			hex = hex
				.split('')
				.map(function (value) {
					return value + value;
				})
				.join('');
		}
		if (hex.length !== 6) {
			return false;
		}
		var r = parseInt(hex.substr(0, 2), 16);
		var g = parseInt(hex.substr(2, 2), 16);
		var b = parseInt(hex.substr(4, 2), 16);
		return r * 0.299 + g * 0.587 + b * 0.114 > 160;
	}

	// 主题色同步到 theme-color，移动端状态栏颜色跟随当前方案
	function syncThemeColor(color) {
		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta && color) {
			meta.setAttribute('content', color);
		}
	}

	function applyScheme(scheme) {
		var side = scheme.side || DEFAULT_SIDE;
		var header = scheme.header || DEFAULT_HEADER;
		var logo = scheme.logo || side;
		var style = document.documentElement.style;
		style.setProperty('--scheme-side', side);
		style.setProperty('--scheme-header', header);
		style.setProperty('--scheme-logo', logo);
		style.setProperty('--scheme-side-text', isLightColor(side) ? '#000000' : '#FFFFFF');
		style.setProperty('--scheme-header-text', isLightColor(header) ? '#000000' : '#FFFFFF');
		syncThemeColor(logo);
		writeStorage('theme-scheme', scheme.id);
	}

	function applyCustomTheme() {
		var style = document.documentElement.style;
		var side = readStorage('theme-custom-side');
		var selected = readStorage('theme-custom-selected');
		var logo = readStorage('theme-custom-logo');
		var header = readStorage('theme-custom-header');
		if (side) {
			style.setProperty('--scheme-side', side);
			style.setProperty('--scheme-side-text', isLightColor(side) ? '#000000' : '#FFFFFF');
		}
		if (selected) {
			style.setProperty('--global-primary-color', selected);
		}
		if (logo) {
			style.setProperty('--scheme-logo', logo);
		}
		if (header) {
			style.setProperty('--scheme-header', header);
			style.setProperty('--scheme-header-text', isLightColor(header) ? '#000000' : '#FFFFFF');
		}
		syncThemeColor(logo || side);
	}

	function getCustomColor(name) {
		var stored = readStorage('theme-custom-' + name);
		if (stored) {
			return stored;
		}
		var style = document.documentElement.style;
		var key = {
			side: '--scheme-side',
			selected: '--global-primary-color',
			logo: '--scheme-logo',
			header: '--scheme-header',
		}[name];
		var value = key ? style.getPropertyValue(key).trim() : '';
		return value || '#FFFFFF';
	}

	function renderCustomPickers() {
		$.each($('.scheme-custom .set-custom-theme'), function () {
			var elem = $(this);
			var name = elem.attr('data-name');
			elem.empty().removeClass('layui-inline').removeAttr('lay-colorpicker-id');
			colorpicker.render({
				elem: elem[0],
				color: getCustomColor(name),
				predefine: true,
				done: function (value) {
					writeStorage('theme-custom-' + name, value);
					applyCustomTheme();
				},
			});
		});
	}

	function buildCustomHtml() {
		return (
			'<div class="mytsaone-color">\n' +
			'<div class="color-title">自定义配色</div>\n' +
			'<div class="scheme-custom">\n' +
			'<ul>\n' +
			'<li><span>主题色</span><div class="set-custom-theme" data-name="side"></div></li>\n' +
			'<li><span>选中色</span><div class="set-custom-theme" data-name="selected"></div></li>\n' +
			'<li><span>LOGO 背景色</span><div class="set-custom-theme" data-name="logo"></div></li>\n' +
			'<li><span>头部栏背景色</span><div class="set-custom-theme" data-name="header"></div></li>\n' +
			'</ul>\n' +
			'</div>\n' +
			'</div>'
		);
	}

	function buildResetHtml() {
		return (
			'<div class="mytsaone-color">\n' +
			'<div class="color-title">恢复默认</div>\n' +
			'<div class="scheme-custom">\n' +
			'<ul>\n' +
			'<li>恢复默认主题 <div class="set-default-theme"><button type="button" class="layui-btn layui-btn-primary reset-theme"><i class="layui-icon layui-icon-refresh-1"></i></button></div></li>\n' +
			'</ul>\n' +
			'</div>\n' +
			'</div>'
		);
	}

	function buildSchemeHtml() {
		var schemes = getSchemeList();
		var current = readStorage('theme-scheme');
		var items = '';
		$.each(schemes, function (i, scheme) {
			var side = scheme.side || '#20222A';
			var header = scheme.header || '#FFFFFF';
			var logo = scheme.logo || side;
			items +=
				'<li' +
				(String(scheme.id) === String(current) ? ' class="layui-this"' : '') +
				' data-select-scheme="' +
				scheme.id +
				'" title="' +
				scheme.label +
				'">' +
				'<div class="scheme-preview">' +
				'<span class="scheme-preview-header" style="background: ' +
				header +
				';"></span>' +
				'<span class="scheme-preview-side" style="background: ' +
				side +
				';"></span>' +
				'<span class="scheme-preview-logo" style="background: ' +
				logo +
				';"></span>' +
				'</div>' +
				'</li>';
		});
		return (
			'<div class="mytsaone-color">\n' +
			'<div class="color-title">配色方案</div>\n' +
			'<div class="scheme-content">\n' +
			'<ul>\n' +
			items +
			'</ul>\n' +
			'</div>\n' +
			'</div>'
		);
	}

	var theme = {
		/**
		 * 主题初始化：配色方案 + 主题色 + 自定义配色 + 自动顶栏
		 *
		 * @param {*} option mytsa.config 配置
		 */
		render: function (option) {
			config = option;

			if (option.theme.allowCustom === false) {
				$('.setting').remove();
			}

			var scheme = resolveScheme(option);
			applyScheme(scheme);

			var colorId = readStorage('theme-color');
			var currentColor = getColorById(colorId);
			writeStorage('theme-color', currentColor.id);
			writeStorage('theme-color-color', currentColor.color);
			writeStorage('theme-color-second', currentColor.second);

			theme.changeTheme();
			applyCustomTheme();
		},

		/**
		 * 切换主题色
		 */
		changeTheme: function () {
			var variableKey = '--global-primary-color';
			var variableVal = readStorage('theme-color-color');
			if (!variableVal) {
				return;
			}
			document.documentElement.style.setProperty(variableKey, variableVal);
		},
	};

	body.on('click', '.setting', function () {
		var schemeHtml = buildSchemeHtml();
		var customHtml = buildCustomHtml();
		var resetHtml = buildResetHtml();

		layer.open({
			type: 1,
			offset: 'r',
			area: ['320px', '100%'],
			title: false,
			shade: 0.1,
			closeBtn: 0,
			shadeClose: false,
			anim: -1,
			skin: 'layer-anim-right',
			move: false,
			content: schemeHtml + customHtml + resetHtml,
			success: function (layero, index) {
				layero.find('.layui-layer-content').css({
					height: '100%',
					overflowY: 'auto',
				});

				form.render();

				renderCustomPickers();

				var currentScheme = readStorage('theme-scheme');
				$('[data-select-scheme]').removeClass('layui-this');
				$("[data-select-scheme='" + currentScheme + "']").addClass('layui-this');

				$('#layui-layer-shade' + index).click(function () {
					var $layero = $('#layui-layer' + index);
					$layero.animate(
						{
							left: $layero.offset().left + $layero.width(),
						},
						200,
						function () {
							layer.close(index);
						}
					);
				});

				form.render('checkbox');
			},
		});
	});

	body.on('click', '[data-select-scheme]', function () {
		var scheme = getItemById(getSchemeList(), $(this).attr('data-select-scheme'));
		if (!scheme) {
			return;
		}
		$('[data-select-scheme]').removeClass('layui-this');
		$(this).addClass('layui-this');
		$.each(['side', 'selected', 'logo', 'header'], function (i, name) {
			removeStorage('theme-custom-' + name);
		});
		applyScheme(scheme);
		theme.changeTheme();
		renderCustomPickers();
	});

	body.on('click', '.reset-theme', function () {
		$.each(
			[
				'theme-scheme',
				'theme-color',
				'theme-color-color',
				'theme-color-second',
				'theme-custom-side',
				'theme-custom-selected',
				'theme-custom-logo',
				'theme-custom-header',
				'theme-menu',
				'theme-header',
				'auto-head',
				'banner',
				'footer',
			],
			function (i, key) {
				removeStorage(key);
			}
		);
		window.location.reload();
	});

	exports(MOD_NAME, theme);
});
