layui.define(['jquery', 'tools', 'element', 'form', 'tabPage', 'menu', 'colorpicker'],
	function (exports) {
		"use strict";

		var $ = layui.jquery,
			form = layui.form,

			menu = layui.menu,
			tabPage = layui.tabPage,

			colorpicker = layui.colorpicker,
			tools = layui.tools;

		var configurationCache;

		var logout = function () { };

		var body = $('body');

		var pearAdmin = new function () {

			this.configuration = {};

			this.configurationPath = "admin/config/pear.config.json";

			this.instances = {};

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 获取 pear.config 实现 [ default ] 
			 */
			this.configurationProvider = () => {
				return new Promise((resolve) => {
					$.ajax({
						type: 'get',
						url: this.configurationPath,
						dataType: 'json',
						async: false,
						success: (result) => {
							resolve(result);
						}
					});
				})
			}

			/**
			 * @since Pear Admin 4.0 
			 * 
			 * 配置 pear.config 路径
			 */
			this.setConfigurationPath = (path) => {
				this.configurationPath = path;
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 获取 pear.config 实现 [ implement ] 
			 */
			this.setConfigurationProvider = (provider) => {
				this.configurationProvider = provider;
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 获取 pear.config 配置
			 */
			this.getConfiguration = () => {
				return this.configuration;
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * Core Function.
			 * 
			 * @param {*} options 
			 */
			this.render = (options) => {
				if (options !== undefined) {
					pearAdmin.apply(options);
				} else {
					this.configurationProvider().then((result) => {
						pearAdmin.apply(result);
					})
				}
			}

			/**
			 * @since Pear Admin 4.0 
			 * 
			 * 启动构建
			 */
			this.apply = function (configuration) {
				configurationCache = configuration;
				if (window.adminDebug) {
					window.adminDebug.setConfig(configuration.debug === true);
				}
				pearAdmin.logoRender(configuration);
				pearAdmin.menuRender(configuration);
				pearAdmin.bodyRender(configuration);
				pearAdmin.themeRender(configuration);
				pearAdmin.keepLoad(configuration);
				window.PearAdmin = pearAdmin;
			}

			this.logoRender = function (param) {
				$(".layui-logo .logo").attr("src", param.logo.image);
				$(".layui-logo .title").html(param.logo.title);
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 侧边菜单
			 */
			this.menuRender = function (param) {
				pearAdmin.instances.menu = menu.render({
					elem: 'side',
					async: param.menu.async,
					method: param.menu.method,

					accordion: param.menu.accordion,
					data: param.menu.data,
					url: param.menu.data,
					parseData: false,
					defaultMenu: 0,
					change: function () {
						compatible();
					},
					done: function () {
						pearAdmin.instances.menu.isCollapse = param.menu.collapse;
						pearAdmin.instances.menu.selectItem(param.menu.select);
						if (param.menu.collapse) {
							if ($(window).width() >= 768) {
								collapse()
							}
						}
					}
				});
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 视图容器
			 */
			this.bodyRender = function (param) {

				body.on("click", ".refresh", function () {
					pearAdmin.refresh();
				})

				pearAdmin.instances.tabPage = tabPage.render({
					elem: 'content',
					session: param.tab.session,
					index: 0,
					tabMax: param.tab.max,
					preload: param.tab.preload,
					closeEvent: function (id) {
						pearAdmin.instances.menu.selectItem(id);
					},
					data: [{
						id: param.tab.index.id,
						url: param.tab.index.href,
						title: param.tab.index.title,
						type: param.tab.index.type,
						close: false
					}],
					success: function (id) {
						if (param.tab.session) {
							setTimeout(function () {
								pearAdmin.instances.menu.selectItem(id);
								pearAdmin.instances.tabPage.positionTab();
							}, 500)
						}
					}
				});

				pearAdmin.instances.tabPage.click(function (id) {
					if (!param.tab.keepState) {
						pearAdmin.instances.tabPage.refresh(false);
					}
					pearAdmin.instances.tabPage.positionTab();
					pearAdmin.instances.menu.selectItem(id);
				})

				pearAdmin.instances.menu.click(function (dom, data) {
					if (data.menuOpenType === "_layer") {
						layer.open({ type: 2, title: data.menuTitle, content: data.menuUrl, area: ['80%', '80%'], maxmin: true })
					} else {
						pearAdmin.instances.tabPage.changePage({
							id: data.menuId,
							title: data.menuTitle,
							type: data.menuOpenType,
							url: data.menuUrl,
							close: true
						});
					}
					compatible();
				})
			}

			this.keepLoad = function (param) {
				compatible()
				setTimeout(function () {
					$(".loader-wrapper").fadeOut(200);
				}, param.other.keepLoad)
			}

			/***
			 * @since Pear Admin 4.0
			 *
			 * 切换主题色
			 */
			this.changeTheme = function () {
				const variableKey = "--global-primary-color";
				const variableVal = localStorage.getItem("theme-color-color");
				document.documentElement.style.setProperty(variableKey, variableVal);
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 主题配置
			 */
			this.themeRender = function (option) {
				if (option.theme.allowCustom === false) {
					$(".setting").remove();
				}
				var scheme = resolveScheme(option);
				applyScheme(scheme);

				var colorId = localStorage.getItem("theme-color");
				var currentColor = getColorById(colorId);
				localStorage.setItem("theme-color", currentColor.id);
				localStorage.setItem("theme-color-color", currentColor.color);
				localStorage.setItem("theme-color-second", currentColor.second);
				pearAdmin.changeTheme();
				applyCustomTheme();

				var autoHead = localStorage.getItem("auto-head");
				if (autoHead === null) {
					autoHead = option.other.autoHead;
				} else {
					if (option.theme.allowCustom === false) {
						autoHead = option.other.autoHead;
					}
				}



				localStorage.setItem("auto-head", autoHead);
			}

			/**
			 * 设置注销逻辑
			 * 
			 * @param callback 实现
			 */
			this.logout = function (callback) {
				if (callback != undefined) {
					logout = callback;
				}
			}

			/**
			 * @since Pear Admin 4.0.3
			 * 
			 * 刷新当前页面
			 */
			this.refresh = function () {
				var refreshBtn = $(".refresh a");
				refreshBtn.addClass("layui-anim layui-anim-rotate layui-anim-loop layui-icon-loading");
				refreshBtn.removeClass("layui-icon-refresh-1");
				pearAdmin.instances.tabPage.refresh(true);
				setTimeout(function () {
					refreshBtn.removeClass("layui-anim layui-anim-rotate layui-anim-loop layui-icon-loading");
					refreshBtn.addClass("layui-icon-refresh-1");
				}, 600)
			}

			/**
			 * @since Pear Admin 4.0.3 
			 * 
			 * 切换内容页面
			 * 
			 * PS: tabPages 模式下，如果页面不存在则新增，反则仅做切换。
			 */
			this.changePage = function (data) {
				pearAdmin.instances.tabPage.changePage({ id: data.id, title: data.title, url: data.url, type: data.type, close: true });
			}

		};

		/**
		 * @since Pear Admin 4.0
		 * 
		 * 菜单折叠
		 */
		function collapse() {
			pearAdmin.instances.menu.collapse();
			var admin = $(".pear-admin");
			var left = $(".layui-icon-spread-left")
			var right = $(".layui-icon-shrink-right")
			if (admin.is(".pear-mini")) {
				left.addClass("layui-icon-shrink-right")
				left.removeClass("layui-icon-spread-left")
				admin.removeClass("pear-mini");
				pearAdmin.instances.menu.isCollapse = false;
			} else {
				right.addClass("layui-icon-spread-left")
				right.removeClass("layui-icon-shrink-right")
				admin.addClass("pear-mini");
				pearAdmin.instances.menu.isCollapse = true;
			}
		}

		/**
		 * @since Pear Admin 4.0
		 * 
		 * 使用 admin.logout(Function) 实现注销 
		 * 
		 * Promise<boolean> 作为返回值类型时，泛型内容为 true 时视为注销成功，则清除 pearAdmin.instances.tabPage 缓存
		 * 
		 * 否则视为注销失败，不做任何处置。
		 */
		body.on("click", ".logout", function () {
			var promise = logout();
			if (promise != undefined) {
				promise.then((asyncResult) => {
					if (asyncResult) {
						if (pearAdmin.instances.tabPage != undefined) {
							pearAdmin.instances.tabPage.clear();
						}
					}
				})
			} else {
				if (pearAdmin.instances.tabPage != undefined) {
					pearAdmin.instances.tabPage.clear();
				}
			}
		})

		body.on("click", ".collapse,.pear-cover", function () {
			collapse();
		});


		body.on("click", '[user-menu-id]', function () {
			pearAdmin.instances.tabPage.changePage({
				id: $(this).attr("user-menu-id"),
				title: $(this).attr("user-menu-title"),
				url: $(this).attr("user-menu-url"),
				close: true
			}, 300);
		});

		body.on("click", ".setting", function () {

			var schemeHtml = buildSchemeHtml();


			var customHtml = buildCustomHtml();
			var resetHtml = buildResetHtml();

			layer.open({
				type: 1,
				offset: 'r',
				area: ['320px', '100%'],
				title: false,
				shade: 0.1,
				closeBtn: 0,
				shadeClose: false,
				anim: -1,
				skin: 'layer-anim-right',
				move: false,
				content: schemeHtml + customHtml + resetHtml,
				success: function (layero, index) {
					layero.find(".layui-layer-content").css({
						height: "100%",
						overflowY: "auto"
					});

					form.render();

					renderCustomPickers();

					var currentScheme = localStorage.getItem("theme-scheme");
					$("[data-select-scheme]").removeClass("layui-this");
					$("[data-select-scheme='" + currentScheme + "']").addClass("layui-this");

					$('#layui-layer-shade' + index).click(function () {
						var $layero = $('#layui-layer' + index);
						$layero.animate({
							left: $layero.offset().left + $layero.width()
						}, 200, function () {
							layer.close(index);
						});
					})


					form.on('switch(auto-head)', function (data) {
						localStorage.setItem("auto-head", this.checked);
						pearAdmin.changeTheme();
					})



					form.render('checkbox');
				}
			});
		});

		body.on('click', '[data-select-scheme]', function () {
			var scheme = getItemById(getSchemeList(), $(this).attr('data-select-scheme'));
			if (!scheme) {
				return;
			}
			$('[data-select-scheme]').removeClass("layui-this");
			$(this).addClass("layui-this");
			$.each(["side", "selected", "logo", "header"], function (i, name) {
				localStorage.removeItem("theme-custom-" + name);
			});
			applyScheme(scheme);
			pearAdmin.changeTheme();
			renderCustomPickers();
		});

		body.on('click', '.reset-theme', function () {
			$.each([
				"theme-scheme",
				"theme-color",
				"theme-color-color",
				"theme-color-second",
				"theme-custom-side",
				"theme-custom-selected",
				"theme-custom-logo",
				"theme-custom-header",
				"theme-menu",
				"theme-header",
				"auto-head",

				"banner",
				"footer"
			], function (i, key) {
				localStorage.removeItem(key);
			});
			window.location.reload();
		});


		function getItemById(list, id) {
			var result = null;
			$.each(list || [], function (i, item) {
				if (String(item.id) === String(id)) {
					result = item;
				}
			});
			return result;
		}

		function getSchemeList() {
			var list = configurationCache && configurationCache.theme && configurationCache.theme.schemes;
			return list && list.length ? list : [
				{ id: "default", label: "default", side: "#20222A", header: "", logo: "" }
			];
		}

		function resolveScheme(option) {
			var schemes = getSchemeList();
			var fallback = getItemById(schemes, option.theme.defaultScheme) || schemes[0];
			if (option.theme.allowCustom === false) {
				return fallback;
			}
			return getItemById(schemes, localStorage.getItem("theme-scheme")) || fallback;
		}

		function getColorById(id) {
			var color = getItemById(configurationCache.colors, id);
			if (color && configurationCache.theme.allowCustom !== false) {
				return color;
			}
			var fallback = getItemById(configurationCache.colors, configurationCache.theme.defaultColor);
			return fallback || configurationCache.colors[0];
		}

		function isLightColor(color) {
			var hex = String(color || "").replace("#", "");
			if (hex.length === 3) {
				hex = hex.split("").map(function (value) {
					return value + value;
				}).join("");
			}
			if (hex.length !== 6) {
				return false;
			}
			var r = parseInt(hex.substr(0, 2), 16);
			var g = parseInt(hex.substr(2, 2), 16);
			var b = parseInt(hex.substr(4, 2), 16);
			return r * 0.299 + g * 0.587 + b * 0.114 > 160;
		}

		function applyScheme(scheme) {
			var side = scheme.side || "#20222A";
			var header = scheme.header || "#FFFFFF";
			var logo = scheme.logo || side;
			var style = document.documentElement.style;
			style.setProperty("--scheme-side", side);
			style.setProperty("--scheme-header", header);
			style.setProperty("--scheme-logo", logo);
			style.setProperty("--scheme-side-text", isLightColor(side) ? "#000000" : "#FFFFFF");
			style.setProperty("--scheme-header-text", isLightColor(header) ? "#000000" : "#FFFFFF");
			localStorage.setItem("theme-scheme", scheme.id);
		}

		function applyCustomTheme() {
			var style = document.documentElement.style;
			var side = localStorage.getItem("theme-custom-side");
			var selected = localStorage.getItem("theme-custom-selected");
			var logo = localStorage.getItem("theme-custom-logo");
			var header = localStorage.getItem("theme-custom-header");
			if (side) {
				style.setProperty("--scheme-side", side);
				style.setProperty("--scheme-side-text", isLightColor(side) ? "#000000" : "#FFFFFF");
			}
			if (selected) {
				style.setProperty("--global-primary-color", selected);
			}
			if (logo) {
				style.setProperty("--scheme-logo", logo);
			}
			if (header) {
				style.setProperty("--scheme-header", header);
				style.setProperty("--scheme-header-text", isLightColor(header) ? "#000000" : "#FFFFFF");
			}
		}

		function getCustomColor(name) {
			var stored = localStorage.getItem("theme-custom-" + name);
			if (stored) {
				return stored;
			}
			var style = document.documentElement.style;
			var key = {
				side: "--scheme-side",
				selected: "--global-primary-color",
				logo: "--scheme-logo",
				header: "--scheme-header"
			}[name];
			var value = key ? style.getPropertyValue(key).trim() : "";
			return value || "#FFFFFF";
		}

		function renderCustomPickers() {
			$.each($(".scheme-custom .set-custom-theme"), function () {
				var elem = $(this);
				var name = elem.attr("data-name");
				elem.empty().removeClass("layui-inline").removeAttr("lay-colorpicker-id");
				colorpicker.render({
					elem: elem[0],
					color: getCustomColor(name),
					predefine: true,
					done: function (value) {
						localStorage.setItem("theme-custom-" + name, value);
						applyCustomTheme();
					}
				});
			});
		}

		function buildCustomHtml() {
			return '<div class="pearone-color">\n' +
				'<div class="color-title">自定义配色</div>\n' +
				'<div class="scheme-custom">\n' +
				'<ul>\n' +
				'<li><span>主题色</span><div class="set-custom-theme" data-name="side"></div></li>\n' +
				'<li><span>选中色</span><div class="set-custom-theme" data-name="selected"></div></li>\n' +
				'<li><span>LOGO 背景色</span><div class="set-custom-theme" data-name="logo"></div></li>\n' +
				'<li><span>头部栏背景色</span><div class="set-custom-theme" data-name="header"></div></li>\n' +

				'</ul>\n' +
				'</div>\n' +
				'</div>';
		}

		function buildResetHtml() {
			return '<div class="pearone-color">\n' +
				'<div class="color-title">恢复默认</div>\n' +
				'<div class="scheme-custom">\n' +
				'<ul>\n' +
				'<li>恢复默认主题 <div class="set-default-theme"><button type="button" class="layui-btn layui-btn-primary reset-theme"><i class="layui-icon layui-icon-refresh-1"></i></button></div></li>\n' +
				'</ul>\n' +
				'</div>\n' +
				'</div>';
		}

		function buildSchemeHtml() {
			var schemes = getSchemeList();
			var current = localStorage.getItem("theme-scheme");
			var items = "";
			$.each(schemes, function (i, scheme) {
				var side = scheme.side || "#20222A";
				var header = scheme.header || "#FFFFFF";
				var logo = scheme.logo || side;
				items +=
					'<li' + (String(scheme.id) === String(current) ? ' class="layui-this"' : '') + ' data-select-scheme="' + scheme.id + '" title="' + scheme.label + '">' +
					'<div class="scheme-preview">' +
					'<span class="scheme-preview-header" style="background: ' + header + ';"></span>' +
					'<span class="scheme-preview-side" style="background: ' + side + ';"></span>' +
					'<span class="scheme-preview-logo" style="background: ' + logo + ';"></span>' +
					'</div>' +
					'</li>';
			});
			return '<div class="pearone-color">\n' +
				'<div class="color-title">配色方案</div>\n' +
				'<div class="scheme-content">\n' +
				'<ul>\n' + items + '</ul>\n' +
				'</div>\n' +
				'</div>';
		}

		function compatible() {
			if ($(window).width() <= 768) {
				collapse()
			}
		}


		

		$(window).on('resize', tools.debounce(function () {
			if (pearAdmin.instances.menu && !pearAdmin.instances.menu.isCollapse && $(window).width() <= 768) {
				collapse();
			}
		}, 50));

		exports('admin', pearAdmin);
	})