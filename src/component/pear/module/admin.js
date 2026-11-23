layui.define(['jquery', 'tools', 'element', 'layer', 'tabPage', 'menu', 'theme'],
	function (exports) {
		"use strict";

		var $ = layui.jquery,
			layer = layui.layer,

			menu = layui.menu,
			tabPage = layui.tabPage,

			theme = layui.theme,
			tools = layui.tools;


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
				return new Promise((resolve, reject) => {
					$.ajax({
						type: 'get',
						url: this.configurationPath,
						dataType: 'json',
						success: (result) => {
							resolve(result);
						},
						error: (xhr, status) => {
							reject(new Error(status || '配置加载失败'));
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
					return Promise.resolve(options);
				}
				return this.configurationProvider()
					.then((result) => {
						pearAdmin.apply(result);
						return result;
					})
					.catch((error) => {
						if (window.adminDebug) {
							window.adminDebug.error(error.message);
						} else if (window.console && window.console.error) {
							window.console.error('[admin] ' + error.message);
						}
						return null;
					})
			}

			/**
			 * @since Pear Admin 4.0 
			 * 
			 * 启动构建
			 */
			this.apply = function (configuration) {

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
				theme.changeTheme();
			}

			/**
			 * @since Pear Admin 4.0
			 * 
			 * 主题配置
			 */
			this.themeRender = function (option) {
				theme.render(option);
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