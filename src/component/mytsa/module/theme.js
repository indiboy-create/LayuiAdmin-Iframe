layui.define(['jquery', 'form', 'layer', 'colorpicker'], function (exports) {
	'use strict';

	var MOD_NAME = 'theme';

	var $ = layui.jquery,
		form = layui.form,
		layer = layui.layer,
		colorpicker = layui.colorpicker;

	var config = null;

	// 主题存储按站点隔离：scope 为空时沿用全局 key，避免破坏旧行为
	var storagePrefix = '';

	var body = $('body');

	// 存储可能在隐私模式、禁用 Cookie 或配额不足时抛异常，统一包一层避免中断主题渲染
	function readStorage(key) {
		try {
			return window.localStorage.getItem(storagePrefix + key);
		} catch (error) {
			return null;
		}
	}

	function writeStorage(key, value) {
		try {
			window.localStorage.setItem(storagePrefix + key, value);
		} catch (error) {
			// 存储不可用时忽略，主题仅在本次会话生效
		}
	}

	function removeStorage(key) {
		try {
			window.localStorage.removeItem(storagePrefix + key);
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
	var DARK_TEXT = {
		strong: 'rgba(255, 255, 255, 0.8)',
		body: 'rgba(255, 255, 255, 0.7)',
		muted: 'rgba(255, 255, 255, 0.65)',
		disabled: 'rgba(255, 255, 255, 0.3)',
	};
	var LIGHT_TEXT = {
		strong: '#333333',
		body: '#333333',
		muted: 'rgba(0, 0, 0, 0.45)',
		disabled: 'rgba(0, 0, 0, 0.3)',
	};

	// 归一化一套配色方案（colors 每项即完整六位置配色）
	function normalizeColor(color) {
		var side = color.side || color.base || DEFAULT_SIDE;
		var header = color.header || color.selected || DEFAULT_HEADER;
		return {
			id: color.id,
			label: color.label,
			side: side,
			header: header,
			headerText: color.headerText || '',
			tab: color.tab || header,
			logo: color.logo || color.selected || side,
			selected: color.selected,
			shades: color.shades || [],
		};
	}

	function getColorById(id) {
		var color = getItemById(config.colors, id);
		if (color && config.theme.allowCustom !== false) {
			return color;
		}
		var fallback = getItemById(config.colors, config.theme.defaultColor);
		return fallback || config.colors[0];
	}

	// 归一化主题模式（仅 light/dark，不含配色）
	function normalizeMode(mode) {
		return {
			id: mode.id,
			label: mode.label,
			mode: mode.mode || (mode.id === 'dark' ? 'dark' : 'light'),
		};
	}

	function getModeList() {
		var list = config && config.theme && config.theme.modes;
		return list && list.length
			? list.map(normalizeMode)
			: [normalizeMode({ id: 'light', label: '浅色模式', mode: 'light' })];
	}

	function resolveMode(option) {
		var modes = getModeList();
		var fallback = getItemById(modes, option.theme.defaultMode) || modes[0];
		if (option.theme.allowCustom === false) {
			return fallback;
		}
		return getItemById(modes, readStorage('theme-mode')) || fallback;
	}

	function resolveColor(option) {
		var fallback = getColorById(option.theme.defaultColor) || config.colors[0];
		if (option.theme.allowCustom === false) {
			return fallback;
		}
		var byId = getItemById(config.colors, readStorage('theme-color'));
		return byId || getStoredColor() || fallback;
	}

	function getCurrentMode() {
		var id = readStorage('theme-mode') || (config && config.theme && config.theme.defaultMode);
		return getItemById(getModeList(), id) || getModeList()[0];
	}

	// 由“配色方案 + 主题模式”合成内部方案对象，供 applyScheme 使用
	function buildEffectiveScheme(color, mode) {
		var c = normalizeColor(color);
		var dark = !!(mode && mode.mode === 'dark');
		return {
			id: mode ? mode.id : c.id,
			label: mode ? mode.label : c.label,
			mode: mode ? mode.mode : 'light',
			side: c.side,
			// 深色模式固定顶栏与标签栏为黑色（不随配色方案变化），顶栏文字用白色
			header: dark ? '#000000' : c.header,
			headerText: dark ? '#ffffff' : c.headerText,
			tab: dark ? '#000000' : c.tab,
			logo: c.logo,
			selected: c.selected,
		};
	}

	// 应用当前“主题模式 + 配色方案”：模式决定 iframe 明暗，六处颜色全部取配色方案
	function applyActiveTheme() {
		var mode = resolveMode(config);
		var color = resolveColor(config);
		applyScheme(buildEffectiveScheme(color, mode));
		applyColor(color);
		writeStorage('theme-mode', mode.id);
		writeStorage('theme-color', color.id);
		writeStorage('theme-color-value', JSON.stringify(color));
		writeStorage('theme-color-color', color.selected);
		writeStorage('theme-color-second', color.tab || '');
		return color;
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

	function hslToHex(h, s, l) {
		var saturation = s / 100;
		var lightness = l / 100;
		var chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
		var second = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
		var match = lightness - chroma / 2;
		var channels =
			h < 60
				? [chroma, second, 0]
				: h < 120
					? [second, chroma, 0]
					: h < 180
						? [0, chroma, second]
						: h < 240
							? [0, second, chroma]
							: h < 300
								? [second, 0, chroma]
								: [chroma, 0, second];
		return (
			'#' +
			channels
				.map(function (value) {
					return ('0' + Math.round((value + match) * 255).toString(16)).slice(-2);
				})
				.join('')
				.toUpperCase()
		);
	}

	function randomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	// 随机配色方案：同一色相派生六位置，保证侧栏/主色/LOGO/头部/顶栏文字/标签栏协调且可读
	function buildRandomPalette() {
		var previous = String(readStorage('theme-color-color') || '').toUpperCase();
		var hue = randomInt(0, 359);
		var saturation = randomInt(56, 70);
		var mainLight = randomInt(44, 52);
		var selected = hslToHex(hue, saturation, mainLight);

		// 与上一次主色重复时，按较大步长换色相，避免连点随机变化不明显
		var guard = 0;
		while (selected === previous && guard < 6) {
			hue = (hue + randomInt(37, 97)) % 360;
			selected = hslToHex(hue, saturation, mainLight);
			guard++;
		}

		var headerLight = randomInt(28, 36);
		var sideLight = randomInt(18, 26);
		var logoLight = Math.max(mainLight - randomInt(10, 16), 30);

		var header = hslToHex(hue, Math.max(saturation - 6, 42), headerLight);
		var side = hslToHex(hue, randomInt(32, 48), sideLight);
		var logo = hslToHex(hue, saturation, logoLight);
		var tab = hslToHex(hue, randomInt(46, 56), randomInt(94, 97));
		var headerText = getReadableTextColor(header);

		// 由浅到深的完整色阶，去重后写入
		var seen = {};
		var shades = [
			tab,
			hslToHex(hue, Math.min(saturation + 6, 78), 88),
			hslToHex(hue, saturation, Math.min(mainLight + 10, 62)),
			selected,
			header,
			side,
		].filter(function (color) {
			var key = String(color).toUpperCase();
			if (seen[key]) {
				return false;
			}
			seen[key] = true;
			return true;
		});

		return {
			id: 'random-' + Date.now(),
			label: '随机',
			side: side,
			selected: selected,
			logo: logo,
			header: header,
			headerText: headerText,
			tab: tab,
			shades: shades,
		};
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

	// 暗底上的对比文字使用 Layui 的 .8 白，避免纯白过硬
	function getContrastText(color) {
		return getReadableTextColor(color) === '#FFFFFF' ? DARK_TEXT.strong : '#000000';
	}

	function normalizeDarkText(value, background) {
		var text = String(value || '').trim();
		return !isLightColor(background) && /^#fff(?:fff)?$/i.test(text) ? DARK_TEXT.strong : value;
	}

	function isDarkHeaderText(value) {
		var text = String(value || '').trim();
		return /^#fff(?:fff)?$/i.test(text) || /^rgba\(\s*255\s*,\s*255\s*,\s*255/.test(text);
	}

	// 暗黑语义文字与填充：正文跟内容区，顶栏相关 token 跟顶栏文字实际明暗
	function setTextVars(darkContent, darkHeader) {
		var style = document.documentElement.style;
		var body = darkContent ? DARK_TEXT : LIGHT_TEXT;
		var header = darkHeader ? DARK_TEXT : LIGHT_TEXT;
		style.setProperty('--scheme-text-strong', body.strong);
		style.setProperty('--scheme-text', body.body);
		style.setProperty('--scheme-text-muted', header.muted);
		style.setProperty('--scheme-text-disabled', body.disabled);
		style.setProperty('--scheme-dropdown-text', darkHeader ? DARK_TEXT.strong : '#FFFFFF');
		style.setProperty(
			'--scheme-subtle-fill',
			darkHeader ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'
		);
		style.setProperty(
			'--scheme-hover-fill',
			darkHeader ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.16)'
		);
	}

	// 顶栏文字/图标色：colors[].headerText > schemes[].headerText > 按背景色自动计算
	function getHeaderTextColor(scheme, header, color) {
		var value =
			(color && color.headerText) ||
			(scheme && scheme.headerText) ||
			getReadableTextColor(header);
		return normalizeDarkText(value, header);
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
		return buildEffectiveScheme(resolveColor(config), getCurrentMode());
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
			style.setProperty('--scheme-selected-text', getContrastText(color.selected));
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
		style.setProperty('--scheme-side-text', getContrastText(side));
		style.setProperty('--scheme-header-text', getHeaderTextColor(scheme, header));
		style.setProperty('--scheme-tab-text', getContrastText(tab));
		setTextVars(darkContent, isDarkHeaderText(style.getPropertyValue('--scheme-header-text')));
		style.setProperty(
			'--scheme-tab-border',
			isLightColor(tab) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'
		);
		style.setProperty('--scheme-body-bg', darkContent ? side : '#F7F7F7');
		style.setProperty('--scheme-card-bg', darkContent ? tab : '#FAFAFA');
		style.setProperty(
			'--scheme-border-muted',
			darkContent ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
		);
		style.setProperty(
			'--scheme-side-border',
			darkSide ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
		);
		syncThemeColor(side);
		writeStorage('theme-mode', scheme.id);
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
			style.setProperty('--scheme-side-text', getContrastText(side));
			style.setProperty(
				'--scheme-side-border',
				isLightColor(side) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'
			);
		}
		if (selected) {
			style.setProperty('--global-selected-color', selected);
			style.setProperty('--scheme-selected-text', getContrastText(selected));
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
			style.setProperty(
				'--scheme-header-text',
				normalizeDarkText(
					headerText,
					header || style.getPropertyValue('--scheme-header').trim()
				)
			);
		}
		setTextVars(
			!isLightColor(tab || style.getPropertyValue('--scheme-tab').trim() || DEFAULT_HEADER),
			isDarkHeaderText(style.getPropertyValue('--scheme-header-text'))
		);
		if (tab) {
			var darkContent = !isLightColor(tab);
			style.setProperty('--scheme-tab', tab);
			style.setProperty('--scheme-tab-text', getContrastText(tab));
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
			style.setProperty(
				'--scheme-border-muted',
				darkContent ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
			);
		}
		syncThemeColor(side || logo);
		syncToIframe(isDarkScheme() ? 'accent' : 'reset');
	}

	// 是否暗黑模式：仅由“主题模式”决定，用于 iframe 明暗推送
	function isDarkScheme() {
		var mode = getCurrentMode();
		return !!(mode && mode.mode === 'dark');
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
		if (name === 'headerText' && /^rgba\(/.test(value)) {
			return isDarkHeaderText(value) ? '#FFFFFF' : '#000000';
		}
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
		var randomItem =
			'<li class="palette-random' +
			(String(current).indexOf('random-') === 0 ? ' layui-this' : '') +
			'" data-random-color title="随机主题色">' +
			'<span class="palette-swatch" style="display:flex;align-items:center;justify-content:center;background:var(--scheme-tab);color:var(--scheme-tab-text);box-shadow:inset 0 0 0 1px var(--scheme-tab-border);font-size:20px;">' +
			'<i class="layui-icon layui-icon-refresh"></i></span>' +
			'</li>';
		return (
			'<div class="mytsaone-color">\n' +
			'<div class="color-title">配色方案</div>\n' +
			'<div class="scheme-content palette-content">\n' +
			'<ul>\n' +
			items +
			randomItem +
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

	function buildModeHtml() {
		var modes = getModeList();
		var current =
			readStorage('theme-mode') || (config && config.theme ? config.theme.defaultMode : '');
		var accent = normalizeColor(resolveColor(config)).selected;
		var items = '';
		$.each(modes, function (i, mode) {
			var dark = mode.mode === 'dark';
			var side = '#23292E';
			var header = dark ? '#2F363C' : '#FAFAFA';
			var tab = dark ? '#23292E' : '#F7F7F7';
			var logo = '#23292E';
			items +=
				'<li' +
				(String(mode.id) === String(current) ? ' class="layui-this"' : '') +
				' data-select-mode="' +
				mode.id +
				'" title="' +
				mode.label +
				'">' +
				'<div class="scheme-preview">' +
				'<span class="scheme-preview-header" style="background: ' +
				header +
				';"></span>' +
				'<span class="scheme-preview-tab" style="background: ' +
				tab +
				';"></span>' +
				'<span class="scheme-preview-selected" style="background: ' +
				accent +
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
			'<div class="color-title">主题模式</div>\n' +
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

			// 按站点隔离主题存储，避免同源多站点共用 localStorage 造成串站
			var site = (option && option.site) || {};
			storagePrefix = site.scope ? 'mytsa:' + site.scope + ':' : '';

			if (option.theme.allowCustom === false) {
				$('.setting').remove();
			}

			// 应用“主题模式 + 配色方案”：模式只决定 iframe 明暗，六处颜色全部取自配色方案
			applyActiveTheme();
			applyCustomTheme();
		},

		/**
		 * 切换主题色
		 */
		changeTheme: function () {
			applyActiveTheme();
		},
	};

	body.on('click', '.setting', function () {
		var modeHtml = buildModeHtml();
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
			content: modeHtml + paletteHtml + customHtml + resetHtml,
			success: function (layero, index) {
				layero.find('.layui-layer-content').css({
					height: '100%',
					overflowY: 'auto',
				});

				form.render();

				renderCustomPickers();

				var currentMode = readStorage('theme-mode');
				$('[data-select-mode]').removeClass('layui-this');
				$("[data-select-mode='" + currentMode + "']").addClass('layui-this');

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

	body.on('click', '[data-select-mode]', function () {
		var mode = getItemById(getModeList(), $(this).attr('data-select-mode'));
		if (!mode) {
			return;
		}
		$('[data-select-mode]').removeClass('layui-this');
		$(this).addClass('layui-this');
		writeStorage('theme-mode', mode.id);
		applyActiveTheme();
		applyCustomTheme();
		renderCustomPickers();
	});

	function applyPresetColor(color, active) {
		$('[data-select-color], [data-random-color]').removeClass('layui-this');
		if (active) {
			active.addClass('layui-this');
		}
		$.each(['side', 'selected', 'logo', 'header', 'headerText', 'tab'], function (i, name) {
			removeStorage('theme-custom-' + name);
		});
		writeStorage('theme-color', color.id);
		writeStorage('theme-color-color', color.selected);
		writeStorage('theme-color-second', color.tab || '');
		writeStorage('theme-color-value', JSON.stringify(color));
		// 六处颜色全部由所选配色方案决定
		applyScheme(buildEffectiveScheme(color, getCurrentMode()));
		applyColor(color);
		applyCustomTheme();
		renderCustomPickers();
	}

	body.on('click', '[data-select-color]', function () {
		var color = getItemById(config.colors, $(this).attr('data-select-color'));
		if (color) {
			applyPresetColor(color, $(this));
		}
	});

	body.on('click', '[data-random-color]', function () {
		applyPresetColor(buildRandomPalette(), $(this));
	});

	body.on('click', '.reset-theme', function () {
		$.each(
			[
				'theme-mode',
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
