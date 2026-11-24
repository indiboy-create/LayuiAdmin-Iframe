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

		// 水印单独放到覆盖层：直接画在 .watermark 容器上会被卡片白色底遮住
		var $layer = $('.pear-watermark-layer');
		if (!$layer.length) {
			$layer = $('<div class="pear-watermark-layer" aria-hidden="true"></div>').appendTo(
				'body'
			);
		}
		$layer.css({
			'background-image': background,
			'background-repeat': 'repeat',
			position: 'fixed',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			'pointer-events': 'none',
			'z-index': 10,
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
