layui.define(['jquery'], function (exports) {
	'use strict';

	var $ = layui.jquery;

	var DEFAULTS = {
		text: 'MyTSA',
		fontSize: 13,
		fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
		color: '#cccccc',
		opacity: 0.2,
		tileWidth: 220,
		tileHeight: 140,
		offsetX: 30,
		offsetY: 98,
		rotate: -18,
		zIndex: 10,
		target: null,
	};

	function drawWatermark(options) {
		var settings = $.extend({}, DEFAULTS, options);
		var ratio = window.devicePixelRatio || 1;
		var canvas = document.createElement('canvas');
		canvas.width = settings.tileWidth * ratio;
		canvas.height = settings.tileHeight * ratio;

		var context = canvas.getContext('2d');
		if (!context) {
			return;
		}

		context.scale(ratio, ratio);
		context.font = settings.fontSize + 'px ' + settings.fontFamily;
		context.fillStyle = settings.color;
		context.globalAlpha = settings.opacity;
		context.translate(settings.offsetX, settings.offsetY);
		context.rotate((settings.rotate * Math.PI) / 180);
		context.fillText(settings.text, 0, 0);

		var background = 'url(' + canvas.toDataURL('image/png') + ')';

		// 水印单独放到覆盖层：直接画在业务容器上会被卡片白色底遮住
		var $container = settings.target ? $(settings.target) : $('body');
		if (!$container.length) {
			return;
		}

		// absolute 只相对已定位的祖先，容器为 static 时补 relative
		if (!$container.is('body') && $container.css('position') === 'static') {
			$container.css('position', 'relative');
		}

		var $layer = $container.children('.mytsa-watermark-layer');
		if (!$layer.length) {
			$layer = $('<div class="mytsa-watermark-layer" aria-hidden="true"></div>').appendTo(
				$container
			);
		}
		$layer.css({
			'background-image': background,
			'background-repeat': 'repeat',
			position: $container.is('body') ? 'fixed' : 'absolute',
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			'pointer-events': 'none',
			'z-index': settings.zIndex,
		});
	}

	function render(options) {
		// 只在顶层窗口绘制：iframe 子页由父框架统一覆盖，避免同一屏出现两层水印；
		// 子页被直接打开（复制地址）时 window.top === window.self，仍会正常绘制
		if (window.top !== window.self) {
			return;
		}
		drawWatermark(options || {});
	}

	exports('watermark', {
		defaults: $.extend({}, DEFAULTS),
		draw: drawWatermark,
		render: render,
	});
});
