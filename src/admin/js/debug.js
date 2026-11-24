/**
 * 统一调试开关
 *
 * 优先级：adminDebug.enable/disable > ?debug=1/0 > localStorage.adminDebug > mytsa.config.json 的 debug
 * 用法：
 *   adminDebug.log(...)、adminDebug.table(...)、adminDebug.time(...)
 *   控制台临时切换：adminDebug.enable() / adminDebug.disable()
 */
(function (window) {
	'use strict';

	var STORAGE_KEY = 'adminDebug';
	var PREFIX = '[admin]';

	var configEnabled = false;
	var override = null;

	function readQuery() {
		var match = window.location.search.match(/[?&]debug(?:=([^&]*))?/);
		if (!match) {
			return null;
		}
		var value = match[1];
		if (value === undefined || value === '' || value === '1' || value === 'true') {
			return true;
		}
		if (value === '0' || value === 'false') {
			return false;
		}
		return null;
	}

	function readStorage() {
		try {
			var value = window.localStorage.getItem(STORAGE_KEY);
			if (value === '1') {
				return true;
			}
			if (value === '0') {
				return false;
			}
		} catch {
			return null;
		}
		return null;
	}

	function isEnabled() {
		if (override !== null) {
			return override;
		}
		var query = readQuery();
		if (query !== null) {
			return query;
		}
		var stored = readStorage();
		if (stored !== null) {
			return stored;
		}
		return configEnabled;
	}

	function output(level, args) {
		if (!isEnabled() || !window.console || typeof window.console[level] !== 'function') {
			return;
		}
		var message = Array.prototype.slice.call(args);
		window.console[level].apply(window.console, [PREFIX].concat(message));
	}

	var api = {
		enable: function () {
			override = true;
		},
		disable: function () {
			override = false;
		},
		isEnabled: isEnabled,
		setConfig: function (value) {
			var before = isEnabled();
			configEnabled = value === true;
			if (!before && isEnabled()) {
				api.info('调试模式已开启，可用 ?debug=0 或 adminDebug.disable() 关闭');
			}
		},
		log: function () {
			output('log', arguments);
		},
		info: function () {
			output('info', arguments);
		},
		warn: function () {
			output('warn', arguments);
		},
		error: function () {
			output('error', arguments);
		},
		debug: function () {
			output('debug', arguments);
		},
		table: function (data) {
			if (!isEnabled() || !window.console || typeof window.console.table !== 'function') {
				return;
			}
			window.console.table(data);
		},
		time: function (label) {
			if (!isEnabled() || !window.console || typeof window.console.time !== 'function') {
				return;
			}
			window.console.time(PREFIX + ' ' + label);
		},
		timeEnd: function (label) {
			if (!isEnabled() || !window.console || typeof window.console.timeEnd !== 'function') {
				return;
			}
			window.console.timeEnd(PREFIX + ' ' + label);
		},
	};

	window.adminDebug = api;

	if (isEnabled()) {
		api.info('调试模式已开启（?debug=1 > localStorage.adminDebug > mytsa.config.json.debug）');
	}
})(window);
