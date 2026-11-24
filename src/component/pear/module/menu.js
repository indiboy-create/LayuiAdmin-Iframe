layui.define(['jquery', 'element'], function (exports) {
	"use strict";

	var MOD_NAME = 'menu',
		$ = layui.jquery,
		element = layui.element;

	var menu = function (opt) {
		this.option = opt;
	};

	menu.prototype.render = function (opt) {

		var option = {
			elem: opt.elem,
			async: typeof opt.async === 'undefined' ? true : opt.async,
			parseData: opt.parseData,
			url: opt.url,
			method: opt.method ? opt.method : "GET",
			defaultOpen: opt.defaultOpen,
			defaultSelect: opt.defaultSelect,

			defaultMenu: opt.defaultMenu || 0,
			accordion: opt.accordion,
			height: opt.height || "100%",
			theme: opt.theme || "dark-theme",
			data: opt.data ? opt.data : [],
			change: opt.change ? opt.change : function () { },
			error: opt.error ? opt.error : function () { },
			done: opt.done ? opt.done : function () { }
		}

		this.option = option;

		var tempDone = option.done;

		option.done = function () {

			tempDone();
		}

		if (option.async) {
			var request = option.method === "GET" ? getData(option.url) : postData(option.url);
			request.then(function (data) {
				option.data = data;
				renderMenu(option);
			}, function (error) {
				option.error(error);
			});
		} else {
			window.setTimeout(function () { renderMenu(option); }, 500);
		}

		$("#" + opt.elem).height(option.height);

		return this;
	}

	menu.prototype.click = function (clickEvent) {
		var _this = this;
		$("body").on("click", "#" + _this.option.elem + " .site-demo-active", function () {
			var dom = $(this);
			var data = {
				menuId: dom.attr("menu-id"),
				menuTitle: dom.attr("menu-title"),
				menuPath: dom.attr("menu-title"),
				menuIcon: dom.attr("menu-icon"),
				menuUrl: dom.attr("menu-url"),
				menuType: dom.attr("menu-type"),
				menuOpenType: dom.attr("menu-open-type")
			};
			var pathParts = [];
			var ancestor = hash(dom);
			var depth = 0;
			while (ancestor && depth < 10) {
				var ancestorTitle = ancestor.find("span").text();
				if (ancestorTitle !== "") {
					pathParts.unshift(ancestorTitle);
				}
				ancestor = hash(ancestor);
				depth++;
			}
			if (pathParts.length > 0) {
				data['menuPath'] = pathParts.join(" / ") + " / " + data['menuPath'];
			}
			if ($("#" + _this.option.elem).is(".pear-nav-mini")) {
				if (_this.option.accordion) {
					activeMenus = $(this).parent().parent().parent().children("a");
				} else {
					activeMenus.push($(this).parent().parent().parent().children("a"));
				}
			}
			clickEvent(dom, data);
		})
	}

	function hash(dom) {
		var d = dom.parent().parent().prev();
		if (d.length === 0 || d.prop("tagName") === "UL") {
			return null;
		}
		return d;
	}

	menu.prototype.skin = function (skin) {
		var menu = $(".pear-nav-tree[lay-filter='" + this.option.elem + "']").parent();
		menu.removeClass("dark-theme");
		menu.removeClass("light-theme");
		menu.addClass(skin);
	}

	function findMenuLink(elem, id) {
		return $("#" + elem + " a[menu-id]").filter(function () {
			return $(this).attr("menu-id") === String(id);
		});
	}

	menu.prototype.selectItem = function (pearId) {

		findMenuLink(this.option.elem, pearId).parents(".pear-nav-tree").find(".layui-this").removeClass(
			"layui-this");
		if (!$("#" + this.option.elem).is(".pear-nav-mini")) {
			var openEle = null;
			var openEleHeight = 0;
			$(findMenuLink(this.option.elem, pearId).parents('.layui-nav-child').get().reverse()).each(function () {
				if (!$(this).parent().is('.layui-nav-itemed')) {
					if (openEleHeight == 0) {
						openEle = $(this);
					} else {
						$(this).parent().addClass('layui-nav-itemed');
						$(this).css({
							height: 'auto',
						});
					}
					openEleHeight += $(this).children("dd").length * 48;
				}
			});
			if (this.option.accordion) {
				if (openEleHeight > 0) {
					var currentDom = openEle.parent().siblings('.layui-nav-itemed').children(".layui-nav-child");
					currentDom.animate({
						height: "0px"
					}, 240, function () {
						currentDom.css({
							height: "auto"
						});
						$(this).parent().removeClass("layui-nav-itemed");
						$(this).find('.layui-nav-itemed').removeClass("layui-nav-itemed");
					});
				}
			}
			if (openEleHeight > 0) {
				openEle.parent().addClass("layui-nav-itemed");
				openEle.height(0);
				openEle.animate({
					height: openEleHeight + "px"
				}, 240, function () {
					$(this).css({ height: 'auto' });
				});
			}
		}
		findMenuLink(this.option.elem, pearId).parent().addClass("layui-this");
	}

	var activeMenus = [];
	menu.prototype.collapse = function () {
		var elem = this.option.elem;
		var config = this.option;
		if ($("#" + this.option.elem).is(".pear-nav-mini")) {
			$.each(activeMenus, function () {
				findMenuLink(elem, $(this).attr("menu-id")).parent().addClass("layui-nav-itemed");
			})
			$("#" + this.option.elem).removeClass("pear-nav-mini");
			$("#" + this.option.elem).animate({
				width: "220px"
			}, 180);
			isHoverMenu(false, config);
			$("#" + this.option.elem)
				.promise()
				.done(function () { })
		} else {
			activeMenus = $("#" + this.option.elem).find(".layui-nav-itemed>a");
			$("#" + this.option.elem).find(".layui-nav-itemed").removeClass("layui-nav-itemed");
			$("#" + this.option.elem).addClass("pear-nav-mini");
			$("#" + this.option.elem).animate({
				width: "60px"
			}, 400);
			$("#" + this.option.elem)
				.promise()
				.done(function () {
					isHoverMenu(true, config);

				})
		}
	}

	function getData(url) {
		var defer = $.Deferred();
		$.ajax({
			url: url,
			type: "GET",
			dataType: "json",
			timeout: 8000
		}).done(function (result) {
			defer.resolve(result);
		}).fail(function (xhr, status) {
			defer.reject(new Error(requestErrorMessage(xhr, status)));
		});
		return defer.promise();
	}

	function postData(url) {
		var defer = $.Deferred();
		$.ajax({
			url: url,
			type: "POST",
			dataType: "json",
			timeout: 8000
		}).done(function (result) {
			defer.resolve(result);
		}).fail(function (xhr, status) {
			defer.reject(new Error(requestErrorMessage(xhr, status)));
		});
		return defer.promise();
	}

	function requestErrorMessage(xhr, status) {
		if (status === "timeout") {
			return "菜单加载失败（请求超时）";
		}
		if (status === "parsererror") {
			return "菜单加载失败（返回内容不是有效的 JSON）";
		}
		var code = xhr && xhr.status;
		if (!code) {
			return "菜单加载失败（网络不可达）";
		}
		return "菜单加载失败（HTTP " + code + "）";
	}

	function renderMenu(option) {
		try {
			if (option.parseData != false) {
				option.parseData(option.data);
			}
			if (!$.isArray(option.data)) {
				throw new Error("菜单数据格式错误，应为数组");
			}
			if (option.data.length > 0) {
				createMenu(option);
			} else {
				renderEmpty(option);
			}
			element.init();
			option.done();
		} catch (error) {
			option.error(error);
		}
	}

	function renderEmpty(option) {
		$("#" + option.elem).html(
			'<div class="pear-menu-empty" style="padding:18px 16px;line-height:1.9;font-size:13px;color:#8a8a8a;">' +
			'<p>暂无菜单数据</p>' +
			'<p style="font-size:12px;color:#6f6f6f;">请检查菜单接口的返回内容</p>' +
			'</div>'
		);
	}

	function escapeHtml(value) {
		return String(value === undefined || value === null ? "" : value)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	function safeHref(url) {
		var value = String(url === undefined || url === null ? "" : url).trim();
		if (!value || /^(?:javascript|data|vbscript):/i.test(value)) {
			return "javascript:;";
		}
		return escapeHtml(value);
	}

	function safeOpenType(type) {
		return type === "_blank" || type === "_layer" || type === "_iframe" ? type : "_iframe";
	}

	function syncMenuAria(elem) {
		$("#" + elem + " a[menu-type='0']").each(function () {
			var $trigger = $(this);
			$trigger.attr("aria-expanded", $trigger.parent().hasClass("layui-nav-itemed") ? "true" : "false");
		});
	}

	function createMenu(option) {
		var menuHtml = '<div style="height:100%!important;" class="pear-side-scroll layui-side-scroll ' + escapeHtml(option.theme) + '"><ul lay-filter="' + escapeHtml(option.elem) +
			'" role="menu" aria-label="主菜单" class="layui-nav arrow   pear-menu layui-nav-tree pear-nav-tree" ' + (option.accordion ? "lay-accordion" : "") + '>'
		$.each(option.data, function (i, item) {
			var content = '<li class="layui-nav-item" role="none">';
			if (i == option.defaultOpen) {
				content = '<li class="layui-nav-item layui-nav-itemed" role="none">';
			}
			var href = "javascript:;";
			var target = "";
			var className = "site-demo-active";
			var openType = safeOpenType(item.openType);
			if (openType === "_blank" && item.type == 1) {
				href = safeHref(item.href);
				target = "target='_blank' rel='noopener noreferrer'";
				className = "";
			}
			if (item.type == 0) {
				content += '<a href="' + href + '" role="menuitem" aria-haspopup="true" aria-expanded="false" menu-type="' + escapeHtml(item.type) + '" menu-id="' + escapeHtml(item.id) +
					'" ' + target + '><i class="' + escapeHtml(item.icon) + '"></i><span>' + escapeHtml(item.title) +
					'</span></a>';
			} else if (item.type == 1) {
				content += '<a class="' + className + '" role="menuitem" menu-type="' + escapeHtml(item.type) + '" menu-open-type="' + openType + '" menu-url="' + safeHref(item.href) + '" menu-id="' +
					escapeHtml(item.id) +
					'" menu-title="' + escapeHtml(item.title) + '" href="' + href + '" ' + target + '><i class="' + escapeHtml(item.icon) +
					'"></i><span>' + escapeHtml(item.title) + '</span></a>';
			}
			// 调 用 递 归 方 法 加 载 无 限 层 级 的 子 菜 单 
			content += loadchild(item);
			// 结 束 一 个 根 菜 单 项
			content += '</li>';
			menuHtml += content;
		});
		// 结 束 菜 单 结 构 的 初 始 化
		menuHtml += "</ul></div>";
		// 将 菜 单 拼 接 到 初 始 化 容 器 中
		$("#" + option.elem).html(menuHtml);
		syncMenuAria(option.elem);
		$("#" + option.elem)
			.off("click.menuAria")
			.on("click.menuAria", function () {
				window.setTimeout(function () {
					syncMenuAria(option.elem);
				}, 0);
			});
		$("#" + option.elem)
			.off("keydown.menuA11y")
			.on("keydown.menuA11y", "a[role='menuitem']", function (event) {
				var $items = $("#" + option.elem + " a[role='menuitem']").filter(":visible");
				if (!$items.length) {
					return;
				}

				var index = $items.index(this);
				var next;
				var $holder = $(this).parent();

				if (event.key === "ArrowDown") {
					next = $items.eq((index + 1) % $items.length);
				} else if (event.key === "ArrowUp") {
					next = $items.eq((index - 1 + $items.length) % $items.length);
				} else if (event.key === "Home") {
					next = $items.first();
				} else if (event.key === "End") {
					next = $items.last();
				} else if (event.key === "ArrowRight") {
					if ($(this).attr("menu-type") === "0" && !$holder.hasClass("layui-nav-itemed")) {
						event.preventDefault();
						$(this).trigger("click");
						window.setTimeout(function () {
							syncMenuAria(option.elem);
						}, 0);
					}
					return;
				} else if (event.key === "ArrowLeft") {
					if ($(this).attr("menu-type") === "0" && $holder.hasClass("layui-nav-itemed")) {
						event.preventDefault();
						$(this).trigger("click");
						window.setTimeout(function () {
							syncMenuAria(option.elem);
						}, 0);
					}
					return;
				} else {
					return;
				}

				event.preventDefault();
				if (next && next.length) {
					next.trigger("focus");
				}
			});
	}


	/** 加载子菜单 (递归)*/
	function loadchild(obj) {
		// 判 单 是 否 是 菜 单， 如 果 是 菜 单 直 接 返 回
		if (obj.type == 1) {
			return "";
		}
		// 创 建 子 菜 单 结 构
		var content = '<dl class="layui-nav-child" role="group">';
		// 如 果 嵌 套 不 等 于 空 
		if (obj.children != null && obj.children.length > 0) {
			// 遍 历 子 项 目
			$.each(obj.children, function (i, note) {
				// 创 建 子 项 结 构
				content += '<dd role="none">';
				var href = "javascript:;";
				var target = "";
				var className = "site-demo-active";
				var openType = safeOpenType(note.openType);
				if (openType === "_blank" && note.type == 1) {
					href = safeHref(note.href);
					target = "target='_blank' rel='noopener noreferrer'";
					className = "";
				}
				// 判 断 子 项 类 型
				if (note.type == 0) {
					// 创 建 目 录 结 构
					content += '<a role="menuitem" aria-haspopup="true" aria-expanded="false" ' + target + ' href="' + href + '" menu-type="' + escapeHtml(note.type) + '" menu-id="' + escapeHtml(note.id) +
						'"><i class="' + escapeHtml(note.icon) + '"></i><span>' + escapeHtml(note.title) + '</span></a>';
				} else if (note.type == 1) {
					// 创 建 菜 单 结 构
					content += '<a role="menuitem" ' + target + ' class="' + className + '" menu-open-type="' + openType + '" menu-type="' + escapeHtml(note.type) + '" menu-url="' + safeHref(note.href) +
						'" menu-id="' + escapeHtml(note.id) + '" menu-title="' + escapeHtml(note.title) + '" menu-icon="' + escapeHtml(note.icon) + '" href="' + href +
						'" ><i class="' + escapeHtml(note.icon) + '"></i><span>' + escapeHtml(note.title) + '</span></a>';
				}
				// 加 载 子 项 目 录
				content += loadchild(note);
				// 结 束 当 前 子 菜 单
				content += '</dd>';
			});
			// 封 装
		} else {
			content += '<dd style="background-color: transparent!important;"><a style="background-color: transparent!important;margin-left: 26px">目录为空</a></dd>';
		}
		content += '</dl>';
		return content;
	}

	/** 二 级 悬 浮 菜 单*/
	function isHoverMenu(b, option) {
		if (b) {
			var navItem = "#" + option.elem + ".pear-nav-mini .layui-nav-item";
			var navChildDl = navItem + " .layui-nav-child>dl";
			var navChildDd = navItem + " .layui-nav-child>dd";

			$(navItem + "," + navChildDd).mouseenter(function () {
				var _this = $(this);
				_this.siblings().find(".layui-nav-child")
					.removeClass("layui-nav-hover").css({
						left: 0,
						top: 0
					});
				_this.children(".layui-nav-child").addClass("layui-nav-hover");
				var height = $(window).height();
				var topLength = _this.offset().top;
				var thisHeight = _this.children(".layui-nav-child").height();
				if ((thisHeight + topLength) > height) {
					topLength = height - thisHeight - 10;
				}
				var left = _this.offset().left + 60;
				if (!_this.hasClass("layui-nav-item")) {
					left = _this.offset().left + _this.width();
				}
				_this.children(".layui-nav-child").offset({
					top: topLength,
					left: left
				});
			});

			$(navItem + "," + navChildDl).mouseleave(function () {
				var _this = $(this);
				_this.closest('.layui-nav-item')
					.find(".layui-nav-child")
					.removeClass("layui-nav-hover")
					.css({
						left: 0,
						top: 0
					});
			});

		} else {
			$("#" + option.elem + " .layui-nav-item").off('mouseenter mouseleave');
			$("#" + option.elem + " dd").off('mouseenter mouseleave');
		}
	}


	exports(MOD_NAME, new menu());
})