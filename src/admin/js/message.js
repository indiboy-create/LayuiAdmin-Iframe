layui.use(['jquery'], function () {
	'use strict';

	var $ = layui.jquery;

	var DEFAULTS = {
		text: 'LayuiAdmin-Iframe',
		fontSize: 13,
		opacity: 0.2,
		color: '#cccccc',
	};

	function drawWatermark(options) {
		var settings = options || {};
		var text = settings.text || DEFAULTS.text;
		var fontSize = settings.fontSize || DEFAULTS.fontSize;
		var opacity = typeof settings.opacity === 'number' ? settings.opacity : DEFAULTS.opacity;
		var color = settings.color || DEFAULTS.color;

		var ratio = window.devicePixelRatio || 1;
		var tileWidth = 220;
		var tileHeight = 140;
		var canvas = document.createElement('canvas');
		canvas.width = tileWidth * ratio;
		canvas.height = tileHeight * ratio;

		var context = canvas.getContext('2d');
		if (!context) {
			return;
		}

		context.scale(ratio, ratio);
		context.font = fontSize + "px 'Microsoft YaHei', 'PingFang SC', sans-serif";
		context.fillStyle = color;
		context.globalAlpha = opacity;
		context.translate(30, tileHeight * 0.7);
		context.rotate((-18 * Math.PI) / 180);
		context.fillText(text, 0, 0);

		var background = 'url(' + canvas.toDataURL('image/png') + ')';
		$('.watermark').css({
			'background-image': background,
			'background-repeat': 'repeat',
			position: 'relative',
		});
	}

	$.getJSON('admin/config/pear.config.json')
		.done(function (config) {
			drawWatermark((config && config.other && config.other.watermark) || {});
		})
		.fail(function () {
			drawWatermark();
		});
});
