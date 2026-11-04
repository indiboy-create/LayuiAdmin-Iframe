layui.define(['jquery'], function (exports) {
	"use strict";

	var $ = layui.jquery;

	var page = function (opt) {
		this.option = opt;
	};

	/**
	 * @since Pear Admin 4.0
	 * 
	 * 创建 Page 页面
	 */
	page.prototype.render = function (opt) {
		var option = {
			elem: opt.elem,
			url: opt.url,
			width: opt.width || "100%",
			height: opt.height || "100%",
			title: opt.title,
			type: "_iframe"
		}
		renderContent(option);
		return new page(option);
	}

	/**
	 * @since Pear Admin 4.0
	 * 
	 * 切换 Page 页面 
	 */
	page.prototype.changePage = function (options) {
		const $frame = $(`#${this.option.elem} .pear-page-content`);
		$frame.html(`<iframe src='${options.href}' scrolling='auto' frameborder='0' allowfullscreen='true'></iframe>`);
		$frame.attr("type", "_iframe");
		$frame.attr("href", options.href);
	}

	page.prototype.refresh = function (loading) {
		var $frameLoad = $(`#${this.option.elem} .pear-page-loading`);
		var $frame = $(`#${this.option.elem} .pear-page-content`);
		if (loading) {
			$frameLoad.css({
				display: 'block'
			});
		}
		$frame.html(`<iframe src='${$frame.attr("href")}' scrolling='auto' frameborder='0' allowfullscreen='true'></iframe>`);
		const $contentFrame = $frame.find("iframe");
		$contentFrame.on("load", () => {
			$frameLoad.fadeOut(1000);
		})
	}

	function renderContent(option) {
		$("#" + option.elem).html(`
			<div class='pear-page'>
				<div class='pear-page-content' type='${option.type}' href='${option.url}'></div>
				<div class="pear-page-loading">
					<div class="ball-loader">
						<span></span>
						<span></span>
						<span></span>
						<span></span>
					</div>
				</div>
			</div>`);

		var $frame = $("#" + option.elem).find(".pear-page-content");

		$frame.html(`<iframe src='${option.url}' scrolling='auto' frameborder='0' allowfullscreen='true'></iframe>`);
	}

	exports('page', new page());
});