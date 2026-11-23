layui.use([], function () {
	'use strict';

	if (!window.gwm) {
		return;
	}

	gwm.creation({
		txt: '13888888888',
		width: 128,
		height: 100,
		x: 20,
		y: 70,
		fontSize: 13,
		color: '#cccccc',
		alpha: 0.2,
		destroy: false,
		container: '.watermark',
	});
});
