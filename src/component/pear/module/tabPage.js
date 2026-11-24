layui.define(['jquery', 'element', 'dropdown', 'layer'], function (exports) {
	"use strict";

	var MOD_NAME = 'tabPage',
		$ = layui.jquery,
		dropdown = layui.dropdown,
		layer = layui.layer,
		element = layui.element;

	var tabPage = function (opt) {
		this.option = opt;
	};

	var tabData = [];
	var tabDataCurrent = 0;
	var contextTabDOM;

	// 存储可能在隐私模式或配额不足时抛异常，统一包一层避免标签页初始化中断
	function readTabStorage(key) {
		try {
			return window.sessionStorage.getItem(key);
		} catch (error) {
			return null;
		}
	}

	function writeTabStorage(key, value) {
		try {
			window.sessionStorage.setItem(key, value);
		} catch (error) {
			// 存储不可用时忽略，标签仅在当前内存中保留
		}
	}

	function removeTabStorage(key) {
		try {
			window.sessionStorage.removeItem(key);
		} catch (error) {
			// 忽略
		}
	}

	function escapeHtml(value) {
		return String(value === undefined || value === null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function safeUrl(value) {
		var url = String(value === undefined || value === null ? "" : value).trim();
		// 这里必须匹配控制字符与空白，用于防止 scheme 被空白/控制字符混淆
		// eslint-disable-next-line no-control-regex
		if (/^(?:javascript|vbscript):/i.test(url.replace(/[\u0000-\u0020]/g, ""))) {
			return "about:blank";
		}
		return url;
	}

	function findFrame(elem, id) {
		return $(".layui-tab[lay-filter='" + elem + "'] .layui-tab-content [data-frameid]").filter(function () {
			return $(this).attr("data-frameid") === String(id);
		});
	}

	function titleHtml(item) {
		return `<span class="pear-tab-page-active"></span>
					 <span class="${item.close ? 'able-close' : 'disable-close'} title">${escapeHtml(item.title)}</span>
					 <i class="layui-icon layui-unselect layui-tab-close" aria-hidden="true">ဆ</i>`;
	}

	function frameHtml(item) {
		return `<iframe id="${escapeHtml(item.id)}" type="_iframe" data-frameid="${escapeHtml(item.id)}" title="${escapeHtml(item.title || item.id)}" scrolling="auto" frameborder="0" src="${escapeHtml(safeUrl(item.url))}" style="width:100%;height:100%;" allowfullscreen="true"></iframe>`;
	}

	function findTabTitle(elem, id) {
		return $(".layui-tab[lay-filter='" + elem + "'] .layui-tab-title li").filter(function () {
			return $(this).attr("lay-id") === String(id);
		});
	}

	function decorateTabs(elem) {
		var $tab = $(".layui-tab[lay-filter='" + elem + "']");
		if (!$tab.length) {
			return;
		}

		var $title = $tab.find(".layui-tab-title");
		var $panels = $tab.find(".layui-tab-content > div");

		$title.attr("role", "tablist");
		$title.find("li[lay-id]").each(function (index) {
			var $li = $(this);
			var selected = $li.hasClass("layui-this");
			var tabId = "pear-tab-" + elem + "-" + String($li.attr("lay-id") || index).replace(/[^\w-]/g, "");
			var panel = $panels.eq(index).get(0);

			$li.attr({
				role: "tab",
				id: tabId,
				tabindex: selected ? "0" : "-1",
				"aria-selected": selected ? "true" : "false",
				"aria-keyshortcuts": "Delete"
			});

			if (panel) {
				panel.id = panel.id || tabId + "-panel";
				$li.attr("aria-controls", panel.id);
				$(panel).attr({
					role: "tabpanel",
					"aria-labelledby": tabId,
					tabindex: "0"
				});
			}
		});
	}

	function bindTabKeyboard(option) {
		var elem = option.elem;
		var $title = $(".layui-tab[lay-filter='" + elem + "'] .layui-tab-title");

		$title
			.off("keydown.pearA11y")
			.on("keydown.pearA11y", "li[role='tab']", function (event) {
				var $items = $title.find("li[role='tab']");
				if (!$items.length) {
					return;
				}

				var index = $items.index(this);
				var next;

				switch (event.key) {
					case "ArrowRight":
					case "ArrowDown":
						next = $items.eq((index + 1) % $items.length);
						break;
					case "ArrowLeft":
					case "ArrowUp":
						next = $items.eq((index - 1 + $items.length) % $items.length);
						break;
					case "Home":
						next = $items.first();
						break;
					case "End":
						next = $items.last();
						break;
					case "Delete":
						if ($(this).find("span").is(".able-close")) {
							event.preventDefault();
							tabDelete(elem, $(this).attr("lay-id"), option.closeEvent);
							window.setTimeout(function () {
								$title.find("li.layui-this").trigger("focus");
							}, 0);
						}
						return;
					case "Enter":
					case " ":
						event.preventDefault();
						element.tabChange(elem, $(this).attr("lay-id"));
						return;
					default:
						return;
				}

				if (!next || !next.length || next.get(0) === this) {
					return;
				}

				event.preventDefault();
				element.tabChange(elem, next.attr("lay-id"));
				decorateTabs(elem);
				next.trigger("focus");
			});
	}

	function isFrameBlank(frame) {
		try {
			var doc = frame.contentDocument;
			return !doc || !doc.body || doc.body.textContent.trim() === "";
		} catch (error) {
			// 跨域页面无法读取内容，交给浏览器处理
			return false;
		}
	}

	function showFrameError(frame, url) {
		var $frame = $(frame);
		if ($frame.siblings(".pear-frame-error").length) {
			return;
		}

		$frame.parent().css("position", "relative");

		var $hint = $("<div class='pear-frame-error' role='alert'></div>").css({
			position: "absolute",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			"z-index": 2,
			display: "flex",
			"flex-direction": "column",
			"align-items": "center",
			"justify-content": "center",
			background: "#fff",
			color: "#666"
		});
		$hint.append('<i class="layui-icon layui-icon-face-cry" style="font-size:42px;color:#c2c2c2"></i>');
		$hint.append('<p style="margin:12px 0 4px">页面加载失败</p>');
		$hint.append(
			$("<p class='pear-frame-error-url' style='margin:0 0 16px;font-size:12px;color:#999'></p>").text(
				url || ""
			)
		);

		var $retry = $('<button type="button" class="layui-btn layui-btn-sm">重新加载</button>');
		$retry.on("click", function () {
			$hint.remove();
			try {
				frame.contentWindow.location.reload();
			} catch (error) {
				frame.setAttribute("src", url || frame.getAttribute("src") || "");
			}
		});
		$hint.append($retry);

		$frame.after($hint);
	}

	function guardFrame(elem, id, url) {
		var frame = findFrame(elem, id).get(0);
		if (!frame) {
			return;
		}

		var timer = null;
		var settled = false;

		function settle(failed) {
			if (settled) {
				return;
			}
			settled = true;
			window.clearTimeout(timer);
			if (failed) {
				showFrameError(frame, url);
			}
		}

		timer = window.setTimeout(function () {
			settle(true);
		}, 15000);

		if (frame.contentDocument && frame.contentDocument.readyState === "complete") {
			settle(isFrameBlank(frame));
			return;
		}

		$(frame).one("load", function () {
			settle(isFrameBlank(frame));
		});
	}

	function readTabSession(elem) {
		var stored = readTabStorage(elem + "-pear-tab-page-data");
		try {
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			return [];
		}
	}

	function saveTabSession(elem, id) {
		writeTabStorage(elem + "-pear-tab-page-data", JSON.stringify(tabData));
		if (id !== undefined) {
			writeTabStorage(elem + "-pear-tab-page-data-current", id);
		}
	}

	tabPage.prototype.render = function (opt) {

		var option = {
			elem: opt.elem,
			data: opt.data,
			index: opt.index,
			tool: opt.tool || true,
			roll: opt.roll || true,
			success: opt.success ? opt.success : function () { },
			session: opt.session ? opt.session : false,
			height: opt.height || "100%",
			width: opt.width || "100%",
			closeEvent: opt.closeEvent,
			tabMax: opt.tabMax,
		}

		option.tool = opt.tool !== false;
		option.roll = opt.roll !== false;

		if (option.session) {
			var storedTabs = readTabSession(option.elem);
			if (storedTabs.length > 0) {
				tabData = storedTabs;
				option.data = storedTabs;
				tabDataCurrent = readTabStorage(option.elem + "-pear-tab-page-data-current");
				tabData.forEach(function (item, index) {
					if (item.id == tabDataCurrent) {
						option.index = index;
					}
				})
			} else {
				tabData = opt.data;
			}
		}

		var lastIndex;
		var tab = createTab(option);
		$("#" + option.elem).html(tab);
		$(".layui-tab[lay-filter='" + option.elem + "'] .layui-tab-prev").click(function () {
			rollPage("left", option);
		})
		$(".layui-tab[lay-filter='" + option.elem + "'] .layui-tab-next").click(function () {
			rollPage("right", option);
		})
		element.init();

		$.each(option.data || [], function (i, item) {
			element.tabAdd(option.elem, {
				id: item.id,
				title: titleHtml(item),
				content: frameHtml(item)
			});
		});

		var defaultTab = option.data && option.data[option.index];
		if (defaultTab) {
			element.tabChange(option.elem, defaultTab.id);
		}

		$("#" + option.elem).width(opt.width);
		$("#" + option.elem).height(opt.height);
		$("#" + option.elem).css({
			position: "relative"
		});

		closeEvent(option);

		option.success(readTabStorage(option.elem + "-pear-tab-page-data-current"));

		dropdown.render({
			elem: `#${option.elem} .layui-tab-control > .layui-icon-down`,
			trigger: 'hover',
			data: [{
				title: '关 闭 当 前',
				id: 1
			}, {
				title: '关 闭 其 他',
				id: 2
			}, {
				title: '关 闭 全 部',
				id: 3
			}],
			click: function (obj) {

				const id = obj.id;
				var currentId, tabtitle;

				if (id === 1) {
					var currentTab = $(".layui-tab[lay-filter='" + option.elem +
						"'] .layui-tab-title .layui-this");
					if (currentTab.find("span").is(".able-close")) {
						currentId = currentTab.attr("lay-id");
						tabDelete(option.elem, currentId, option.closeEvent, option);
					} else {
						layer.msg("当前页面不允许关闭", {
							icon: 3,
							time: 1000
						})
					}
				} else if (id === 2) {
					currentId = $(".layui-tab[lay-filter='" + option.elem +
						"'] .layui-tab-title .layui-this").attr("lay-id");
					tabtitle = $(".layui-tab[lay-filter='" + option.elem + "'] .layui-tab-title li");
					$.each(tabtitle, function () {
						if ($(this).attr("lay-id") != currentId) {
							if ($(this).find("span").is(".able-close")) {
								tabDelete(option.elem, $(this).attr("lay-id"), option.closeEvent,
									option);
							}
						}
					})
				} else {
					currentId = $(".layui-tab[lay-filter='" + option.elem +
						"'] .layui-tab-title .layui-this").attr("lay-id");
					tabtitle = $(".layui-tab[lay-filter='" + option.elem + "'] .layui-tab-title li");
					$.each(tabtitle, function () {
						if ($(this).find("span").is(".able-close")) {
							tabDelete(option.elem, $(this).attr("lay-id"), option.closeEvent, option);
						}
					})
				}

			}
		})

		$("body .layui-tab[lay-filter='" + option.elem + "'] .layui-tab-title").on("contextmenu", "li",
			function (e) {
				var top = e.clientY;
				var left = e.clientX;
				var menuWidth = 100;
				var menu = `<ul>
								<li class='item' id='${option.elem}closeThis'>关闭当前</li>
								<li class='item' id='${option.elem}closeOther'>关闭其他</li>
								<li class='item' id='${option.elem}closeAll'>关闭所有</li>
							</ul>`;

				contextTabDOM = $(this);
				var isOutsideBounds = (left + menuWidth) > $(window).width();
				if (isOutsideBounds) {
					left = $(window).width() - menuWidth;
				}

				layer.open({
					type: 1,
					title: false,
					shade: false,
					skin: 'pear-tab-page-menu',
					closeBtn: false,
					area: [menuWidth + 'px', '108px'],
					fixed: true,
					anim: false,
					isOutAnim: false,
					offset: [top, left],
					content: menu,
					success: function (layero, index) {
						layer.close(lastIndex);
						lastIndex = index;
						menuEvent(option, index);
						var timer;
						$(layero).on('mouseout', function () {
							timer = setTimeout(function () {
								layer.close(index);
							}, 30)
						});

						$(layero).on('mouseover', function () {
							clearTimeout(timer);
						});

						$(layero).on('contextmenu', function () {
							return false;
						})
					}
				});
				return false;
			})

		mousewheelAndTouchmoveHandler(option)
		bindTabKeyboard(option);
		decorateTabs(option.elem);
		return new tabPage(option);
	}

	var clickCallbacks = {};
	var boundClickElems = {};

	tabPage.prototype.click = function (callback) {
		var elem = this.option.elem;
		clickCallbacks[elem] = callback;

		if (boundClickElems[elem]) {
			return;
		}
		boundClickElems[elem] = true;

		element.on('tab(' + elem + ')', function () {
			var id = $("#" + elem + " .layui-tab-title .layui-this").attr("lay-id");
			decorateTabs(elem);
			writeTabStorage(elem + "-pear-tab-page-data-current", id);
			var handler = clickCallbacks[elem];
			if (typeof handler === 'function') {
				handler(id);
			}
		});
	}

	tabPage.prototype.positionTab = function () {
		var $tabTitle = $('.layui-tab[lay-filter=' + this.option.elem + ']  .layui-tab-title');
		var autoLeft = 0;
		$tabTitle.children("li").each(function () {
			if ($(this).hasClass('layui-this')) {
				return false;
			} else {
				autoLeft += $(this).outerWidth();
			}
		});
		$tabTitle.animate({
			scrollLeft: autoLeft - $tabTitle.width() / 3
		}, 200);
	}

	tabPage.prototype.clear = function () {
		removeTabStorage(this.option.elem + "-pear-tab-page-data");
		removeTabStorage(this.option.elem + "-pear-tab-page-data-current");
	}

	tabPage.prototype.changeTabTitleById = function (id, title) {
		var currentTab = findTabTitle(this.option.elem, id).find(".title");
		currentTab.text(title === undefined || title === null ? "" : String(title));
	}

	/**
	 * @since Pear Admin 4.0
	 * 
	 * 删除指定选项卡
	 * 
	 * @param id 编号
	 */
	tabPage.prototype.removeTab = function (id) {
		var elem = this.option.elem;
		if (id != undefined) {
			var currentTab = findTabTitle(elem, id);
			if (currentTab.find("span").is(".able-close")) {
				tabDelete(elem, id, () => { });
			}
		} else {
			var tabtitle = $(".layui-tab[lay-filter='" + elem + "'] .layui-tab-title li");
			$.each(tabtitle, function () {
				if ($(this).find("span").is(".able-close")) {
					tabDelete(elem, $(this).attr("lay-id"), () => { });
				}
			})
		}
	}

	/**
	 * @since Pear Admin 4.0
	 * 
	 * 删除其他选项卡
	 */
	tabPage.prototype.removeOtherTab = function () {
		var elem = this.option.elem;
		var currentId = $(".layui-tab[lay-filter='" + elem + "'] .layui-tab-title .layui-this").attr("lay-id");
		var tabtitle = $(".layui-tab[lay-filter='" + elem + "'] .layui-tab-title li");
		$.each(tabtitle, function () {
			if ($(this).attr("lay-id") != currentId) {
				if ($(this).find("span").is(".able-close")) {
					tabDelete(elem, $(this).attr("lay-id"), () => { });
				}
			}
		})
	}

	/**
	 * @since Pear Admin 4.0
	 * 
	 * 删除选中选项卡
	 */
	tabPage.prototype.removeCurrentTab = function () {
		var currentTab = $(".layui-tab[lay-filter='" + this.option.elem + "'] .layui-tab-title .layui-this");
		if (currentTab.find("span").is(".able-close")) {
			var currentId = currentTab.attr("lay-id");
			tabDelete(this.option.elem, currentId, () => { });
		}
	}

	/**
	 * @since Pear Admin 4.0
	 * 
	 * 切换选项卡
	 * 
	 * @param opt 内容
	 */
	tabPage.prototype.changePage = function (opt) {

		var that = this;

		if (opt.type === "_blank") {
			return;
		}
		opt.type = "_iframe";

		var title = titleHtml(opt);

		if ($(".layui-tab[lay-filter='" + this.option.elem + "'] .layui-tab-title li[lay-id]").length <=
			0) {

			element.tabAdd(this.option.elem, {
				id: opt.id,
				title: title,
				content: frameHtml(opt)
			});
			guardFrame(that.option.elem, opt.id, opt.url);

			tabData.push(opt);
			writeTabStorage(that.option.elem + "-pear-tab-page-data", JSON.stringify(tabData));
			writeTabStorage(that.option.elem + "-pear-tab-page-data-current", opt.id);

		} else {

			var isData = false;
			$.each($(".layui-tab[lay-filter='" + this.option.elem + "'] .layui-tab-title li[lay-id]"),
				function () {
					if ($(this).attr("lay-id") == opt.id) {
						isData = true;
					}
				})

			if (isData == false) {

				if (this.option.tabMax != false) {
					if ($(".layui-tab[lay-filter='" + this.option.elem + "'] .layui-tab-title li[lay-id]")
						.length >= this.option.tabMax) {
						layer.msg("最多打开" + this.option.tabMax + "个标签页", {
							icon: 2,
							time: 1000,
							shift: 6
						});
						return false;
					}
				}

				element.tabAdd(this.option.elem, {
					id: opt.id,
					title: title,
					content: frameHtml(opt)
				});
				guardFrame(that.option.elem, opt.id, opt.url);
				tabData.push(opt);
				writeTabStorage(that.option.elem + "-pear-tab-page-data", JSON.stringify(tabData));
				writeTabStorage(that.option.elem + "-pear-tab-page-data-current", opt.id);
			}
		}
		element.tabChange(this.option.elem, opt.id);
		writeTabStorage(this.option.elem + "-pear-tab-page-data-current", opt.id);
		decorateTabs(this.option.elem);
	}

	/**
	 * 刷新当前选型卡
	 * 
	 * @param time 动画时长
	 */
	tabPage.prototype.refresh = function (time) {

		var $iframe = $(".layui-tab[lay-filter='" + this.option.elem + "'] .layui-tab-content .layui-show > div[data-frameid], " +
			".layui-tab[lay-filter='" + this.option.elem + "'] .layui-tab-content .layui-show > iframe[data-frameid]");
		var $iframeLoad;

		if (time != false && time != 0) {
			$iframeLoad = $("#" + this.option.elem).find(".pear-tab-page-loading");
			$iframeLoad.css({
				display: "block"
			});
		}

		$iframe.attr("src", $iframe.attr("src"));
		$iframe.off("load").on("load", function () {
			if (!$iframeLoad || !$iframeLoad.length) {
				return;
			}
			$iframeLoad.fadeOut(1000, function () {
				$iframeLoad.css({
					display: "none"
				});
			});
		})
	}

	function tabDelete(elem, id, callback) {

		var removeTab = findTabTitle(elem, id);
		var nextNode = removeTab.next("li");
		if (!removeTab.hasClass("layui-this")) {
			removeTab.remove();
			findFrame(elem, id).parent().remove();

			tabData = readTabSession(elem).filter(function (item) {
				return item.id != id;
			})
			saveTabSession(elem);
			decorateTabs(elem);
			return false;
		}

		var currId;
		if (nextNode.length) {
			nextNode.addClass("layui-this");
			currId = nextNode.attr("lay-id");
			findFrame(elem, currId).parent().addClass("layui-show");
		} else {
			var prevNode = removeTab.prev("li");
			prevNode.addClass("layui-this");
			currId = prevNode.attr("lay-id");
			findFrame(elem, currId).parent().addClass("layui-show");
		}
		callback(currId);
		tabData = readTabSession(elem).filter(function (item) {
			return item.id != id;
		})
		saveTabSession(elem, currId);
		removeTab.remove();
		findFrame(elem, id).parent().remove();
		decorateTabs(elem);
	}

	/**
	 * @since Pear Admin 4.0
	 */
	function createTab(option) {

		var type = "";
		if (option.roll == true) {
			type = "layui-tab-roll";
		}
		if (option.tool != false) {
			type = "layui-tab-tool";
		}
		if (option.roll == true && option.tool != false) {
			type = "layui-tab-rollTool";
		}

		var control = `<div class="layui-tab-control">
							<li class="layui-tab-prev layui-icon layui-icon-left"></li>
							<li class="layui-tab-next layui-icon layui-icon-right"></li>
							<li class="layui-tab-tool layui-icon layui-icon-down"></li>
						</div>`;
		var loading =
			'<div class="pear-tab-page-loading"><div class="ball-loader"><span></span><span></span><span></span><span></span></div></div>';

		return '<div class="pear-tab-page ' + type + ' layui-tab" lay-filter="' + option.elem +
			'" lay-allowClose="true">' +
			'<ul class="layui-tab-title"></ul>' +
			control +
			'<div class="layui-tab-content"></div>' +
			loading +
			'</div>';
	}

	function rollPage(d, option) {
		var $tabTitle = $('#' + option.elem + '  .layui-tab-title');
		var left = $tabTitle.scrollLeft();
		if ('left' === d) {
			$tabTitle.animate({
				scrollLeft: left - 450
			}, 200);
		} else {
			$tabTitle.animate({
				scrollLeft: left + 450
			}, 200);
		}
	}

	function closeEvent(option) {
		$(".layui-tab[lay-filter='" + option.elem + "']")
			.on("click", ".layui-tab-close", function () {
				var layid = $(this).parent().attr("lay-id");
				tabDelete(option.elem, layid, option.closeEvent, option);
			})
			.on("mousedown", ".layui-tab-title li", function (e) {
				if (e.buttons === 4 && $(this).find("span").is(".able-close")) {
					tabDelete(option.elem, $(this).attr("lay-id"), option.closeEvent, option);
				}
			});
	}

	function menuEvent(option, index) {

		$("#" + option.elem + "closeThis").click(function () {
			var currentTab = contextTabDOM;

			if (currentTab.find("span").is(".able-close")) {
				var currentId = currentTab.attr("lay-id");
				tabDelete(option.elem, currentId, option.closeEvent, option);
			} else {
				layer.msg("当前页面不允许关闭", {
					icon: 3,
					time: 800
				})
			}
			layer.close(index);
		})

		$("#" + option.elem + "closeOther").click(function () {
			var currentId = contextTabDOM.attr("lay-id");
			var tabtitle = $(".layui-tab[lay-filter='" + option.elem + "'] .layui-tab-title li");
			$.each(tabtitle, function () {
				if ($(this).attr("lay-id") != currentId) {
					if ($(this).find("span").is(".able-close")) {
						tabDelete(option.elem, $(this).attr("lay-id"), option.closeEvent,
							option);
					}
				}
			})
			layer.close(index);
		})

		$("#" + option.elem + "closeAll").click(function () {
			var tabtitle = $(".layui-tab[lay-filter='" + option.elem + "'] .layui-tab-title li");
			$.each(tabtitle, function () {
				if ($(this).find("span").is(".able-close")) {
					tabDelete(option.elem, $(this).attr("lay-id"), option.closeEvent, option);
				}
			})
			layer.close(index);
		})
	}

	function mousewheelAndTouchmoveHandler(option) {
		var $bodyTab = $("body .layui-tab[lay-filter='" + option.elem + "'] .layui-tab-title")
		var $tabTitle = $('#' + option.elem + '  .layui-tab-title');
		var mouseScrollStep = 100
		// 鼠标滚轮
		$bodyTab.on("mousewheel DOMMouseScroll", function (e) {
			e.originalEvent.preventDefault()
			var delta = (e.originalEvent.wheelDelta && (e.originalEvent.wheelDelta > 0 ? "top" :
				"down")) || // chrome & ie
				(e.originalEvent.detail && (e.originalEvent.detail > 0 ? "down" : "top")); // firefox
			var scrollLeft = $tabTitle.scrollLeft();

			if (delta === "top") {
				scrollLeft -= mouseScrollStep
			} else if (delta === "down") {
				scrollLeft += mouseScrollStep
			}
			$tabTitle.scrollLeft(scrollLeft)
		});

		// 触摸移动
		var touchX = 0;
		$bodyTab.on("touchstart", function (e) {
			var touch = e.originalEvent.targetTouches[0];
			touchX = touch.pageX
		})

		$bodyTab.on("touchmove", function (e) {
			var event = e.originalEvent;
			if (event.targetTouches.length > 1) return;
			event.preventDefault();
			var touch = event.targetTouches[0];
			var distanceX = touchX - touch.pageX
			var scrollLeft = $tabTitle.scrollLeft();
			touchX = touch.pageX
			$tabTitle.scrollLeft(scrollLeft + distanceX)
		});
	}

	exports(MOD_NAME, new tabPage());
})
