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

	var DEFAULT_SIDE = '#23292E';
	var DEFAULT_HEADER = '#FAFAFA';

	function normalizeScheme(scheme) {
		var base = scheme.base || scheme.side || DEFAULT_SIDE;
		var header = scheme.header || DEFAULT_HEADER;
		return {
			id: scheme.id,
			label: scheme.label,
			mode: scheme.mode || '',
			side: base,
			header: header,
			headerText: scheme.headerText || '',
			tab: scheme.tab || header,
			logo: scheme.logo || base,
			selected: scheme.selected,
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

	function getColorByValue(value) {
		var result = null;
		$.each(config.colors || [], function (i, item) {
			if (String(item.selected).toLowerCase() === String(value || '').toLowerCase()) {
				result = item;
				return false;
			}
		});
		return result;
	}

	// 方案自带选中色：优先命中同名主题色以复用完整色阶，否则回退默认色
	function applySelectedColor(value) {
		var color = getColorByValue(value) || getColorById(config.theme.defaultColor);
		if (!color) {
			return;
		}
		writeStorage('theme-color', color.id);
		writeStorage('theme-color-color', color.selected);
		writeStorage('theme-color-second', color.tab || '');
		writeStorage('theme-color-value', JSON.stringify(color));
	}

	var IFRAME_BACKGROUND_VARS = [
		'--scheme-body-bg',
		'--scheme-card-bg',
		'--scheme-text',
		'--scheme-border-muted',
	];
	var IFRAME_ACCENT_VARS = [
		'--scheme-side-border',
		'--scheme-selected-text',
		'--global-selected-color',
		'--global-tab-color',
		'--global-header-color',
		'--global-color-1',
		'--global-color-2',
		'--global-color-3',
		'--global-color-4',
		'--global-color-5',
	];
	var IFRAME_VARS = IFRAME_BACKGROUND_VARS.concat(IFRAME_ACCENT_VARS);

	function parseRgb(color) {
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
			return null;
		}
		return [
			parseInt(hex.substr(0, 2), 16),
			parseInt(hex.substr(2, 2), 16),
			parseInt(hex.substr(4, 2), 16),
		];
	}

	function isLightColor(color) {
		var rgb = parseRgb(color);
		if (!rgb) {
			return false;
		}
		return rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 160;
	}

	// 按 WCAG 相对亮度比较黑白文字对比度，避免亮色底上白字偏淡
	function getReadableTextColor(color) {
		var rgb = parseRgb(color);
		if (!rgb) {
			return '#FFFFFF';
		}
		var channels = rgb.map(function (value) {
			var channel = value / 255;
			return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
		});
		var luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
		var contrastWithBlack = (luminance + 0.05) / 0.05;
		var contrastWithWhite = 1.05 / (luminance + 0.05);
		return contrastWithBlack >= contrastWithWhite ? '#000000' : '#FFFFFF';
	}

	// 顶栏文字/图标色：colors[].headerText > schemes[].headerText > 按背景色自动计算
	function getHeaderTextColor(scheme, header, color) {
		return (
			(color && color.headerText) ||
			(scheme && scheme.headerText) ||
			getReadableTextColor(header)
		);
	}

	function getStoredColor() {
		var stored = readStorage('theme-color-value');
		if (!stored) {
			return null;
		}
		try {
			return JSON.parse(stored);
		} catch (error) {
			return null;
		}
	}

	function getCurrentScheme() {
		var id =
			readStorage('theme-scheme') || (config && config.theme && config.theme.defaultScheme);
		return getItemById(getSchemeList(), id);
	}

	function collectIframeVars() {
		var names = IFRAME_ACCENT_VARS;
		var style = document.documentElement.style;
		var computed = window.getComputedStyle(document.documentElement);
		var vars = {};
		$.each(names, function (i, name) {
			var value = style.getPropertyValue(name).trim();
			if (!value) {
				value = computed.getPropertyValue(name).trim();
			}
			if (value) {
				vars[name] = value;
			}
		});
		return vars;
	}

	// full: 激活 iframe 暗黑模式并推送强调色；accent: 仅强调色；reset: 基础配色不入侵 iframe
	function syncToIframe(scope) {
		var origin = window.location.origin;
		if (!origin || origin === 'null') {
			origin = '*';
		}
		var payload;
		if (scope === 'reset') {
			removeStorage('theme-iframe-vars');
			payload = { type: 'mytsa-theme', reset: true, names: IFRAME_VARS };
		} else {
			var vars = collectIframeVars();
			payload = { type: 'mytsa-theme', vars: vars };
			if (scope === 'full') {
				payload.mode = 'dark';
				writeStorage('theme-iframe-vars', JSON.stringify(payload));
			} else {
				var stored = readStorage('theme-iframe-vars');
				if (stored) {
					try {
						var previous = JSON.parse(stored);
						$.each(vars, function (name, value) {
							previous.vars[name] = value;
						});
						writeStorage('theme-iframe-vars', JSON.stringify(previous));
					} catch (error) {
						// 缓存损坏时保留已推送的强调色
					}
				}
			}
		}
		try {
			$.each(document.querySelectorAll('iframe'), function (i, frame) {
				if (frame.contentWindow) {
					frame.contentWindow.postMessage(payload, origin);
				}
			});
		} catch (error) {
			// 跨域 iframe 不可推送，子页仍可在加载时读取同源存储
		}
	}

	// 主题色同步到 theme-color，移动端状态栏颜色跟随当前方案
	function syncThemeColor(color) {
		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta && color) {
			meta.setAttribute('content', color);
		}
	}

	// 主题色阶写入 CSS 变量：主色、辅助色、深色，以及任意扩展色阶
	function applyColor(color) {
		if (!color) {
			return;
		}
		var style = document.documentElement.style;
		if (color.selected) {
			style.setProperty('--global-selected-color', color.selected);
			style.setProperty('--scheme-selected-text', getReadableTextColor(color.selected));
		}
		if (color.tab) {
			style.setProperty('--global-tab-color', color.tab);
		}
		if (color.header) {
			style.setProperty('--global-header-color', color.header);
		}
		$.each(color.shades || [], function (i, value) {
			style.setProperty('--global-color-' + (i + 1), value);
		});
	}

	function applyScheme(scheme) {
		var side = scheme.side || DEFAULT_SIDE;
		var header = scheme.header || DEFAULT_HEADER;
		var tab = scheme.tab || header;
		var logo = scheme.logo || side;
		var darkContent = !isLightColor(tab);
		var darkSide = !isLightColor(side);
		var style = document.documentElement.style;
		style.setProperty('--scheme-side', side);
		style.setProperty('--scheme-header', header);
		style.setProperty('--scheme-tab', tab);
		style.setProperty('--scheme-logo', logo);
		style.setProperty('--scheme-side-text', getReadableTextColor(side));
		style.setProperty('--scheme-header-text', getHeaderTextColor(scheme, header));
		style.setProperty('--scheme-tab-text', getReadableTextColor(tab));
		style.setProperty(
			'--scheme-tab-border',
			isLightColor(tab) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'
		);
		style.setProperty('--scheme-body-bg', darkContent ? side : '#F7F7F7');
		style.setProperty('--scheme-card-bg', darkContent ? tab : '#FAFAFA');
		style.setProperty('--scheme-text', darkContent ? '#E6E8EB' : '#333333');
		style.setProperty(
			'--scheme-border-muted',
			darkContent ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
		);
		style.setProperty(
			'--scheme-side-border',
			darkSide ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
		);
		syncThemeColor(side);
		writeStorage('theme-scheme', scheme.id);
		syncToIframe(scheme.mode === 'dark' ? 'full' : 'reset');
	}

	function applyCustomTheme() {
		var style = document.documentElement.style;
		var side = readStorage('theme-custom-side');
		var selected = readStorage('theme-custom-selected');
		var logo = readStorage('theme-custom-logo');
		var header = readStorage('theme-custom-header');
		var headerText = readStorage('theme-custom-headerText');
		var tab = readStorage('theme-custom-tab');
		if (side) {
			style.setProperty('--scheme-side', side);
			style.setProperty('--scheme-side-text', getReadableTextColor(side));
			style.setProperty(
				'--scheme-side-border',
				isLightColor(side) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
			);
		}
		if (selected) {
			style.setProperty('--global-selected-color', selected);
			style.setProperty('--scheme-selected-text', getReadableTextColor(selected));
		}
		if (logo) {
			style.setProperty('--scheme-logo', logo);
		}
		if (header) {
			style.setProperty('--scheme-header', header);
			style.setProperty(
				'--scheme-header-text',
				getHeaderTextColor(getCurrentScheme(), header, getStoredColor())
			);
		}
		if (headerText) {
			style.setProperty('--scheme-header-text', headerText);
		}
		if (tab) {
			var darkContent = !isLightColor(tab);
			style.setProperty('--scheme-tab', tab);
			style.setProperty('--scheme-tab-text', getReadableTextColor(tab));
			style.setProperty(
				'--scheme-tab-border',
				isLightColor(tab) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'
			);
			style.setProperty(
				'--scheme-body-bg',
				darkContent
					? style.getPropertyValue('--scheme-side').trim() || DEFAULT_SIDE
					: '#F7F7F7'
			);
			style.setProperty('--scheme-card-bg', darkContent ? tab : '#FAFAFA');
			style.setProperty('--scheme-text', darkContent ? '#E6E8EB' : '#333333');
			style.setProperty(
				'--scheme-border-muted',
				darkContent ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
			);
		}
		syncThemeColor(side || logo);
		syncToIframe(isDarkScheme() ? 'accent' : 'reset');
	}

	// 当前方案是否为暗黑模式：按 scheme.mode 判定，旧配置按 id 回退
	function isDarkScheme() {
		var scheme = getCurrentScheme();
		if (!scheme) {
			return false;
		}
		return scheme.mode ? scheme.mode === 'dark' : scheme.id === 'dark';
	}

	// 根据方案明暗选择色阶：浅色基调用主色/浅色阶，深色基调用深色阶
	function applyPaletteAreaValues(areas, color) {
		if (!areas || !areas.header || !areas.tab) {
			return;
		}
		var style = document.documentElement.style;
		var logo = areas.logo || DEFAULT_SIDE;
		var header = areas.header;
		var tab = areas.tab;
		var darkTab = !isLightColor(tab);
		style.setProperty('--scheme-logo', logo);
		style.setProperty('--scheme-header', header);
		style.setProperty(
			'--scheme-header-text',
			getHeaderTextColor(getCurrentScheme(), header, color)
		);
		style.setProperty('--scheme-tab', tab);
		style.setProperty('--scheme-tab-text', getReadableTextColor(tab));
		style.setProperty(
			'--scheme-tab-border',
			isLightColor(tab) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'
		);
		style.setProperty(
			'--scheme-body-bg',
			darkTab ? style.getPropertyValue('--scheme-side').trim() || DEFAULT_SIDE : '#F7F7F7'
		);
		style.setProperty('--scheme-card-bg', darkTab ? tab : '#FAFAFA');
		style.setProperty('--scheme-text', darkTab ? '#E6E8EB' : '#333333');
		style.setProperty(
			'--scheme-border-muted',
			darkTab ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
		);
	}

	function applyLightAccent(color) {
		var areas = {
			logo: color.header || color.selected,
			header: color.selected,
			tab: color.tab || color.selected,
		};
		applyPaletteAreaValues(areas, color);
		writeStorage('theme-palette-areas', JSON.stringify(areas));
	}

	function applyDarkAccent(color) {
		// 暗黑模式背景完全锁死，只更新主色相关的文字对比色
		document.documentElement.style.setProperty(
			'--scheme-selected-text',
			getReadableTextColor(color.selected)
		);
	}

	function applyPaletteAreas(color) {
		if (!color) {
			return;
		}
		if (isDarkScheme()) {
			applyDarkAccent(color);
			syncToIframe('accent');
		} else {
			applyLightAccent(color);
			syncToIframe('reset');
		}
	}

	function getCustomColor(name) {
		var stored = readStorage('theme-custom-' + name);
		if (stored) {
			return stored;
		}
		var style = document.documentElement.style;
		var key = {
			side: '--scheme-side',
			selected: '--global-selected-color',
			logo: '--scheme-logo',
			header: '--scheme-header',
			headerText: '--scheme-header-text',
			tab: '--scheme-tab',
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
			'<li><span>侧栏背景色</span><div class="set-custom-theme" data-name="side"></div></li>\n' +
			'<li><span>主色（选中色）</span><div class="set-custom-theme" data-name="selected"></div></li>\n' +
			'<li><span>LOGO 背景色</span><div class="set-custom-theme" data-name="logo"></div></li>\n' +
			'<li><span>头部栏背景色</span><div class="set-custom-theme" data-name="header"></div></li>\n' +
			'<li><span>顶栏文字色</span><div class="set-custom-theme" data-name="headerText"></div></li>\n' +
			'<li><span>标签栏背景色</span><div class="set-custom-theme" data-name="tab"></div></li>\n' +
			'</ul>\n' +
			'</div>\n' +
			'</div>'
		);
	}

	function buildPaletteHtml() {
		var colors = config && config.colors ? config.colors : [];
		var current =
			readStorage('theme-color') || (config && config.theme ? config.theme.defaultColor : '');
		var items = '';
		$.each(colors, function (i, color) {
			items +=
				'<li' +
				(String(color.id) === String(current) ? ' class="layui-this"' : '') +
				' data-select-color="' +
				color.id +
				'" title="' +
				(color.label || color.selected) +
				'">' +
				'<span class="palette-swatch" style="background: ' +
				color.selected +
				';"></span>' +
				'</li>';
		});
		return (
			'<div class="mytsaone-color">\n' +
			'<div class="color-title">主题色预设</div>\n' +
			'<div class="scheme-content palette-content">\n' +
			'<ul>\n' +
			items +
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
			var side = scheme.side || '#23292E';
			var header = scheme.header || '#FAFAFA';
			var tab = scheme.tab || header;
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
				'<span class="scheme-preview-tab" style="background: ' +
				tab +
				';"></span>' +
				'<span class="scheme-preview-selected" style="background: ' +
				scheme.selected +
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

			var storedColor = readStorage('theme-color-value');
			if (storedColor) {
				try {
					applyPaletteAreas(JSON.parse(storedColor));
				} catch (error) {
					// 缓存损坏时回退方案默认色
				}
			} else {
				var defaultColor = getColorById(config.theme.defaultColor);
				applySelectedColor(defaultColor ? defaultColor.selected : scheme.selected);
				if (defaultColor) {
					applyPaletteAreas(defaultColor);
				}
			}

			theme.changeTheme();
			applyCustomTheme();
		},

		/**
		 * 切换主题色
		 */
		changeTheme: function () {
			var stored = readStorage('theme-color-value');
			var color = null;
			if (stored) {
				try {
					color = JSON.parse(stored);
				} catch (error) {
					color = null;
				}
			}
			if (!color) {
				color = {
					selected: readStorage('theme-color-color'),
					tab: readStorage('theme-color-second'),
				};
			}
			applyColor(color);
			syncToIframe(isDarkScheme() ? 'accent' : 'reset');
		},
	};

	body.on('click', '.setting', function () {
		var schemeHtml = buildSchemeHtml();
		var paletteHtml = buildPaletteHtml();
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
			content: schemeHtml + paletteHtml + customHtml + resetHtml,
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
		$.each(['side', 'selected', 'logo', 'header', 'headerText', 'tab'], function (i, name) {
			removeStorage('theme-custom-' + name);
		});
		applyScheme(scheme);
		var storedColor = readStorage('theme-color-value');
		if (storedColor) {
			try {
				applyPaletteAreas(JSON.parse(storedColor));
			} catch (error) {
				// 缓存损坏时保留方案默认区域色
			}
		}
		theme.changeTheme();
		renderCustomPickers();
	});

	body.on('click', '[data-select-color]', function () {
		var color = getItemById(config.colors, $(this).attr('data-select-color'));
		if (!color) {
			return;
		}
		$('[data-select-color]').removeClass('layui-this');
		$(this).addClass('layui-this');
		removeStorage('theme-custom-selected');
		writeStorage('theme-color', color.id);
		writeStorage('theme-color-color', color.selected);
		writeStorage('theme-color-second', color.tab || '');
		writeStorage('theme-color-value', JSON.stringify(color));
		applyColor(color);
		applyPaletteAreas(color);
		applyCustomTheme();
		renderCustomPickers();
	});

	body.on('click', '.reset-theme', function () {
		$.each(
			[
				'theme-scheme',
				'theme-color',
				'theme-color-color',
				'theme-color-second',
				'theme-color-value',
				'theme-palette-areas',
				'theme-iframe-vars',
				'theme-custom-side',
				'theme-custom-selected',
				'theme-custom-logo',
				'theme-custom-header',
				'theme-custom-headerText',
				'theme-custom-tab',
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
