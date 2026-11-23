layui.use(['jquery'], function () {
	'use strict';

	var $ = layui.jquery;

	if (!window.gwm) {
		return;
	}

	var DEFAULTS = {
		text: 'LayuiAdmin-Iframe',
		fontSize: 13,
		opacity: 0.2,
	};

	function render(options) {
		var settings = options || {};
		gwm.creation({
			txt: settings.text || DEFAULTS.text,
			width: 128,
			height: 100,
			x: 20,
			y: 70,
			fontSize: settings.fontSize || DEFAULTS.fontSize,
			color: '#cccccc',
			alpha: typeof settings.opacity === 'number' ? settings.opacity : DEFAULTS.opacity,
			destroy: false,
			container: '.watermark',
		});
	}

	$.getJSON('admin/config/pear.config.json')
		.done(function (config) {
			var watermark = (config && config.other && config.other.watermark) || {};
			render({
				text: watermark.text,
				fontSize: watermark.fontSize,
				opacity: watermark.opacity,
			});
		})
		.fail(function () {
			render();
		});
});
