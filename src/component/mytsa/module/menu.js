layui.define(['jquery', 'element', 'sanitize'], function (exports) {
	'use strict';

	var MOD_NAME = 'menu',
		$ = layui.jquery,
		element = layui.element,
		sanitize = layui.sanitize,
		escapeHtml = sanitize.escapeHtml,
		safeHref = sanitize.safeHref,
		requestErrorMessage = sanitize.requestErrorMessage;

	var menu = function (opt) {
		this.option = opt;
	};

	menu.prototype.render = function (opt) {
		var option = {
			elem: opt.elem,
			async: typeof opt.async === 'undefined' ? true : opt.async,
			parseData: opt.parseData,
			url: opt.url,
			method: opt.method ? opt.method : 'GET',
			defaultOpen: opt.defaultOpen,
			defaultSelect: opt.defaultSelect,

			defaultMenu: opt.defaultMenu || 0,
			accordion: opt.accordion,
			height: opt.height || '100%',
			theme: opt.theme || 'dark-theme',
			data: opt.data ? opt.data : [],
			change: opt.change ? opt.change : function () {},
			error: opt.error ? opt.error : function () {},
			done: opt.done ? opt.done : function () {},
		};

		this.option = option;

		var tempDone = option.done;

		option.done = function () {
			tempDone();
		};

		if (option.async) {
			var request = option.method === 'GET' ? getData(option.url) : postData(option.url);
			request.then(
				function (data) {
					option.data = data;
					renderMenu(option);
				},
				function (error) {
					option.error(error);
				}
			);
		} else {
			window.setTimeout(function () {
				renderMenu(option);
			}, 500);
		}

		$('#' + opt.elem).height(option.height);

		return this;
	};

	menu.prototype.click = function (clickEvent) {
		var _this = this;
		$('body').on('click', '#' + _this.option.elem + ' .site-demo-active', function () {
			var dom = $(this);
			var data = {
				menuId: dom.attr('menu-id'),
				menuTitle: dom.attr('menu-title'),
				menuPath: dom.attr('menu-title'),
				menuIcon: dom.attr('menu-icon'),
				menuUrl: dom.attr('menu-url'),
				menuType: dom.attr('menu-type'),
				menuOpenType: dom.attr('menu-open-type'),
			};
			var pathParts = [];
			var ancestor = hash(dom);
			var depth = 0;
			while (ancestor && depth < 10) {
				var ancestorTitle = ancestor.find('span').text();
				if (ancestorTitle !== '') {
					pathParts.unshift(ancestorTitle);
				}
				ancestor = hash(ancestor);
				depth++;
			}
			if (pathParts.length > 0) {
				data['menuPath'] = pathParts.join(' / ') + ' / ' + data['menuPath'];
			}
			if ($('#' + _this.option.elem).is('.mytsa-nav-mini')) {
				if (_this.option.accordion) {
					activeMenus = $(this).parent().parent().parent().children('a');
				} else {
					activeMenus.push($(this).parent().parent().parent().children('a'));
				}
			}
			clickEvent(dom, data);
		});
	};

	function hash(dom) {
		var d = dom.parent().parent().prev();
		if (d.length === 0 || d.prop('tagName') === 'UL') {
			return null;
		}
		return d;
	}

	menu.prototype.skin = function (skin) {
		var menu = $(".mytsa-nav-tree[lay-filter='" + this.option.elem + "']").parent();
		menu.removeClass('dark-theme');
		menu.removeClass('light-theme');
		menu.addClass(skin);
	};

	function findMenuLink(elem, id) {
		return $('#' + elem + ' a[menu-id]').filter(function () {
			return $(this).attr('menu-id') === String(id);
		});
	}

	menu.prototype.selectItem = function (mytsaId) {
		findMenuLink(this.option.elem, mytsaId)
			.parents('.mytsa-nav-tree')
			.find('.layui-this')
			.removeClass('layui-this');
		if (!$('#' + this.option.elem).is('.mytsa-nav-mini')) {
			var openEle = null;
			var openEleHeight = 0;
			$(
				findMenuLink(this.option.elem, mytsaId).parents('.layui-nav-child').get().reverse()
			).each(function () {
				if (!$(this).parent().is('.layui-nav-itemed')) {
					if (openEleHeight == 0) {
						openEle = $(this);
					} else {
						$(this).parent().addClass('layui-nav-itemed');
						$(this).css({
							height: 'auto',
						});
					}
					openEleHeight += $(this).children('dd').length * 48;
				}
			});
			if (this.option.accordion) {
				if (openEleHeight > 0) {
					var currentDom = openEle
						.parent()
						.siblings('.layui-nav-itemed')
						.children('.layui-nav-child');
					currentDom.animate(
						{
							height: '0px',
						},
						240,
						function () {
							currentDom.css({
								height: 'auto',
							});
							$(this).parent().removeClass('layui-nav-itemed');
							$(this).find('.layui-nav-itemed').removeClass('layui-nav-itemed');
						}
					);
				}
			}
			if (openEleHeight > 0) {
				openEle.parent().addClass('layui-nav-itemed');
				openEle.height(0);
				openEle.animate(
					{
						height: openEleHeight + 'px',
					},
					240,
					function () {
						$(this).css({ height: 'auto' });
					}
				);
			}
		}
		findMenuLink(this.option.elem, mytsaId).parent().addClass('layui-this');
	};

	var activeMenus = [];
	menu.prototype.collapse = function () {
		var elem = this.option.elem;
		var config = this.option;
		if ($('#' + this.option.elem).is('.mytsa-nav-mini')) {
			$.each(activeMenus, function () {
				findMenuLink(elem, $(this).attr('menu-id')).parent().addClass('layui-nav-itemed');
			});
			$('#' + this.option.elem).removeClass('mytsa-nav-mini');
			$('#' + this.option.elem).animate(
				{
					width: '220px',
				},
				180
			);
			isHoverMenu(false, config);
			$('#' + this.option.elem)
				.promise()
				.done(function () {});
		} else {
			activeMenus = $('#' + this.option.elem).find('.layui-nav-itemed>a');
			$('#' + this.option.elem)
				.find('.layui-nav-itemed')
				.removeClass('layui-nav-itemed');
			$('#' + this.option.elem).addClass('mytsa-nav-mini');
			$('#' + this.option.elem).animate(
				{
					width: '60px',
				},
				400
			);
			$('#' + this.option.elem)
				.promise()
				.done(function () {
					isHoverMenu(true, config);
				});
		}
	};

	function getData(url) {
		var defer = $.Deferred();
		$.ajax({
			url: url,
			type: 'GET',
			dataType: 'json',
			timeout: 8000,
		})
			.done(function (result) {
				defer.resolve(result);
			})
			.fail(function (xhr, status) {
				defer.reject(new Error(requestErrorMessage(xhr, status)));
			});
		return defer.promise();
	}

	function postData(url) {
		var defer = $.Deferred();
		$.ajax({
			url: url,
			type: 'POST',
			dataType: 'json',
			timeout: 8000,
		})
			.done(function (result) {
				defer.resolve(result);
			})
			.fail(function (xhr, status) {
				defer.reject(new Error(requestErrorMessage(xhr, status)));
			});
		return defer.promise();
	}

	function renderMenu(option) {
		try {
			if (option.parseData != false) {
				option.parseData(option.data);
			}
			if (!$.isArray(option.data)) {
				throw new Error('菜单数据格式错误，应为数组');
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
		$('#' + option.elem).html(
			'<div class="mytsa-menu-empty" style="padding:18px 16px;line-height:1.9;font-size:13px;color:#8a8a8a;">' +
				'<p>暂无菜单数据</p>' +
				'<p style="font-size:12px;color:#6f6f6f;">请检查菜单接口的返回内容</p>' +
				'</div>'
		);
	}

	function safeOpenType(type) {
		return type === '_blank' || type === '_layer' || type === '_iframe' ? type : '_iframe';
	}

	function createMenu(option) {
		var menuHtml =
			'<div style="height:100%!important;" class="mytsa-side-scroll layui-side-scroll ' +
			escapeHtml(option.theme) +
			'"><ul lay-filter="' +
			escapeHtml(option.elem) +
			'" class="layui-nav arrow   mytsa-menu layui-nav-tree mytsa-nav-tree" ' +
			(option.accordion ? 'lay-accordion' : '') +
			'>';
		$.each(option.data, function (i, item) {
			var content = '<li class="layui-nav-item">';
			if (i == option.defaultOpen) {
				content = '<li class="layui-nav-item layui-nav-itemed">';
			}
			var href = 'javascript:;';
			var target = '';
			var className = 'site-demo-active';
			var openType = safeOpenType(item.openType);
			if (openType === '_blank' && item.type == 1) {
				href = safeHref(item.href);
				target = "target='_blank' rel='noopener noreferrer'";
				className = '';
			}
			if (item.type == 0) {
				content +=
					'<a href="' +
					href +
					'" menu-type="' +
					escapeHtml(item.type) +
					'" menu-id="' +
					escapeHtml(item.id) +
					'" ' +
					target +
					'><i class="' +
					escapeHtml(item.icon) +
					'"></i><span>' +
					escapeHtml(item.title) +
					'</span></a>';
			} else if (item.type == 1) {
				content +=
					'<a class="' +
					className +
					'" menu-type="' +
					escapeHtml(item.type) +
					'" menu-open-type="' +
					openType +
					'" menu-url="' +
					safeHref(item.href) +
					'" menu-id="' +
					escapeHtml(item.id) +
					'" menu-title="' +
					escapeHtml(item.title) +
					'" href="' +
					href +
					'" ' +
					target +
					'><i class="' +
					escapeHtml(item.icon) +
					'"></i><span>' +
					escapeHtml(item.title) +
					'</span></a>';
			}
			// 调 用 递 归 方 法 加 载 无 限 层 级 的 子 菜 单
			content += loadchild(item);
			// 结 束 一 个 根 菜 单 项
			content += '</li>';
			menuHtml += content;
		});
		// 结 束 菜 单 结 构 的 初 始 化
		menuHtml += '</ul></div>';
		// 将 菜 单 拼 接 到 初 始 化 容 器 中
		$('#' + option.elem).html(menuHtml);
	}

	/** 加载子菜单 (递归)*/
	function loadchild(obj) {
		// 判 单 是 否 是 菜 单， 如 果 是 菜 单 直 接 返 回
		if (obj.type == 1) {
			return '';
		}
		// 创 建 子 菜 单 结 构
		var content = '<dl class="layui-nav-child">';
		// 如 果 嵌 套 不 等 于 空
		if (obj.children != null && obj.children.length > 0) {
			// 遍 历 子 项 目
			$.each(obj.children, function (i, note) {
				// 创 建 子 项 结 构
				content += '<dd>';
				var href = 'javascript:;';
				var target = '';
				var className = 'site-demo-active';
				var openType = safeOpenType(note.openType);
				if (openType === '_blank' && note.type == 1) {
					href = safeHref(note.href);
					target = "target='_blank' rel='noopener noreferrer'";
					className = '';
				}
				// 判 断 子 项 类 型
				if (note.type == 0) {
					// 创 建 目 录 结 构
					content +=
						'<a ' +
						target +
						' href="' +
						href +
						'" menu-type="' +
						escapeHtml(note.type) +
						'" menu-id="' +
						escapeHtml(note.id) +
						'"><i class="' +
						escapeHtml(note.icon) +
						'"></i><span>' +
						escapeHtml(note.title) +
						'</span></a>';
				} else if (note.type == 1) {
					// 创 建 菜 单 结 构
					content +=
						'<a ' +
						target +
						' class="' +
						className +
						'" menu-open-type="' +
						openType +
						'" menu-type="' +
						escapeHtml(note.type) +
						'" menu-url="' +
						safeHref(note.href) +
						'" menu-id="' +
						escapeHtml(note.id) +
						'" menu-title="' +
						escapeHtml(note.title) +
						'" menu-icon="' +
						escapeHtml(note.icon) +
						'" href="' +
						href +
						'" ><i class="' +
						escapeHtml(note.icon) +
						'"></i><span>' +
						escapeHtml(note.title) +
						'</span></a>';
				}
				// 加 载 子 项 目 录
				content += loadchild(note);
				// 结 束 当 前 子 菜 单
				content += '</dd>';
			});
			// 封 装
		} else {
			content +=
				'<dd style="background-color: transparent!important;"><a style="background-color: transparent!important;margin-left: 26px">目录为空</a></dd>';
		}
		content += '</dl>';
		return content;
	}

	/** 二 级 悬 浮 菜 单*/
	function isHoverMenu(b, option) {
		if (b) {
			var navItem = '#' + option.elem + '.mytsa-nav-mini .layui-nav-item';
			var navChildDl = navItem + ' .layui-nav-child>dl';
			var navChildDd = navItem + ' .layui-nav-child>dd';

			$(navItem + ',' + navChildDd).mouseenter(function () {
				var _this = $(this);
				_this.siblings().find('.layui-nav-child').removeClass('layui-nav-hover').css({
					left: 0,
					top: 0,
				});
				_this.children('.layui-nav-child').addClass('layui-nav-hover');
				var height = $(window).height();
				var topLength = _this.offset().top;
				var thisHeight = _this.children('.layui-nav-child').height();
				if (thisHeight + topLength > height) {
					topLength = height - thisHeight - 10;
				}
				var left = _this.offset().left + 60;
				if (!_this.hasClass('layui-nav-item')) {
					left = _this.offset().left + _this.width();
				}
				_this.children('.layui-nav-child').offset({
					top: topLength,
					left: left,
				});
			});

			$(navItem + ',' + navChildDl).mouseleave(function () {
				var _this = $(this);
				_this
					.closest('.layui-nav-item')
					.find('.layui-nav-child')
					.removeClass('layui-nav-hover')
					.css({
						left: 0,
						top: 0,
					});
			});
		} else {
			$('#' + option.elem + ' .layui-nav-item').off('mouseenter mouseleave');
			$('#' + option.elem + ' dd').off('mouseenter mouseleave');
		}
	}

	exports(MOD_NAME, new menu());
});
