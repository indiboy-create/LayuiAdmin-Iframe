layui.define(['jquery'], function (exports) {
	'use strict';

	var $ = layui.jquery;

	var DEFAULTS = {
		text: '13888888888',
		fontSize: 11,
		fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
		color: '#cccccc',
		opacity: 0.2,
		tileWidth: 100,
		tileHeight: 100,
		offsetX: 50,
		offsetY: 50,
		rotate: -15,
		zIndex: 10,
		target: '.watermark',
	};

	function drawWatermark(options) {
		var settings = $.extend({}, DEFAULTS, options);
		// 默认不绘制：文档中没有 .watermark 容器时直接返回，不做任何 canvas 计算
		var $containers = $(settings.target || DEFAULTS.target);
		if (!$containers.length) {
			return;
		}
		var ratio = window.devicePixelRatio || 1;
		var rad = (settings.rotate * Math.PI) / 180;
		var cos = Math.cos(rad);
		var sin = Math.sin(rad);

		// 测量文字旋转后的真实包围盒，并把文字整体平移进平铺块，避免号码被裁切
		var measure = document.createElement('canvas').getContext('2d');
		if (!measure) {
			return;
		}
		measure.font = settings.fontSize + 'px ' + settings.fontFamily;
		var metrics = measure.measureText(settings.text);
		var textWidth = metrics.width;
		var ascent = metrics.actualBoundingBoxAscent || settings.fontSize * 0.8;
		var descent = metrics.actualBoundingBoxDescent || settings.fontSize * 0.2;

		var corners = [
			[0, -ascent],
			[textWidth, -ascent],
			[textWidth, descent],
			[0, descent],
		].map(function (point) {
			return [point[0] * cos - point[1] * sin, point[0] * sin + point[1] * cos];
		});
		var xs = corners.map(function (point) {
			return point[0];
		});
		var ys = corners.map(function (point) {
			return point[1];
		});
		var minX = Math.min.apply(null, xs);
		var maxX = Math.max.apply(null, xs);
		var minY = Math.min.apply(null, ys);
		var maxY = Math.max.apply(null, ys);

		var padX = settings.offsetX;
		var padY = settings.offsetY;
		var tileWidth = Math.max(settings.tileWidth, Math.ceil(maxX - minX + padX) + 2);
		var tileHeight = Math.max(settings.tileHeight, Math.ceil(maxY - minY + padY) + 2);

		var canvas = document.createElement('canvas');
		canvas.width = tileWidth * ratio;
		canvas.height = tileHeight * ratio;

		var context = canvas.getContext('2d');
		if (!context) {
			return;
		}

		context.scale(ratio, ratio);
		context.font = settings.fontSize + 'px ' + settings.fontFamily;
		context.fillStyle = settings.color;
		context.globalAlpha = settings.opacity;
		context.translate(padX - minX, padY - minY);
		context.rotate(rad);
		context.fillText(settings.text, 0, 0);

		var background = 'url(' + canvas.toDataURL('image/png') + ')';

		// 水印只作用于 .watermark 容器（可同时存在多个），逐个铺一层覆盖层；
		// 直接画在业务容器上会被卡片白色底遮住，因此用独立覆盖层

		$containers.each(function () {
			var $container = $(this);
			// absolute 只相对已定位的祖先，容器为 static 时补 relative
			if (!$container.is('body') && $container.css('position') === 'static') {
				$container.css('position', 'relative');
			}
			var $layer = $container.children('.mytsa-watermark-layer');
			if (!$layer.length) {
				$layer = $('<div class="mytsa-watermark-layer"></div>').appendTo($container);
			}
			$layer.css({
				'background-image': background,
				'background-repeat': 'repeat',
				'background-size': tileWidth + 'px ' + tileHeight + 'px',
				position: $container.is('body') ? 'fixed' : 'absolute',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				'pointer-events': 'none',
				'z-index': settings.zIndex,
			});
		});
	}

	function render(options) {
		// 水印只在当前文档内绘制：由 iframe 文件夹里的子页各自渲染，
		// 后台入口 panel.html 不再统一覆盖，避免水印侵入后台框架
		drawWatermark(options || {});
	}

	exports('watermark', {
		defaults: $.extend({}, DEFAULTS),
		draw: drawWatermark,
		render: render,
	});
});
