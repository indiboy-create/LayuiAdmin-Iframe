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

		function escapeHtml(value) {
			return String(value === undefined || value === null ? '' : value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');
		}

		function logError(title, error) {
			var detail = error && error.message ? error.message : String(error || '');
			var message = (title ? title + '：' : '') + detail;
			if (window.adminDebug) {
				window.adminDebug.error(message);
			} else if (window.console && window.console.error) {
				window.console.error('[admin] ' + message);
			}
		}

		function isFrameLoaded(frame) {
			try {
				return frame.contentDocument && frame.contentDocument.readyState === "complete";
			} catch (error) {
				return false;
			}
		}

		function waitFrameLoad(frame) {
			return new Promise(function (resolve) {
				if (!frame || isFrameLoaded(frame)) {
					resolve();
					return;
				}
				frame.addEventListener("load", resolve, { once: true });
			});
		}

		var pearAdmin = new function () {

			this.configuration = {};

			this.configurationPath = "admin/config/pear.config.json";

			this.instances = {};

			this.menuReady = Promise.resolve();

			this.frameReady = Promise.resolve();

			/**
			 * 首屏加载兜底定时器
			 */
			this.loaderGuard = null;

			/**
			 * 错误面板是否已展示，避免重复弹出
			 */
			this.errorVisible = false;

			/**
			 * 隐藏首屏 loading
			 */
			this.hideLoader = function () {
				var loader = $('.loader-wrapper');
				if (loader.length) {
					loader.fadeOut(200);
				}
			}

			/**
			 * 初始化阶段的致命错误：结束 loading 并给出可重试的提示
			 *
			 * @param title 标题
			 * @param error 错误对象或文本
			 */
			this.reportError = function (title, error) {
				var detail = error && error.message ? error.message : String(error || '未知错误');
				detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
				pearAdmin.hideLoader();
				logError(title, error);

				if (pearAdmin.errorVisible) {
					return;
				}
				if (!layer || typeof layer.open !== 'function') {
					window.alert(title + '：' + detail);
					return;
				}
				pearAdmin.errorVisible = true;
				layer.open({
					type: 1,
					title: escapeHtml(title),
					area: [Math.min(420, Math.max(280, window.innerWidth - 40)) + 'px', 'auto'],
					shade: 0.3,
					content:
						'<div style="padding:18px 20px;line-height:1.8;">' +
						'<p style="color:#666;">' + escapeHtml(detail) + '</p>' +
						'<p style="color:#999;font-size:12px;">请检查配置文件与接口是否可访问，或点击下方按钮重试。</p>' +
						'</div>',
					btn: ['重新加载'],
					yes: function (index) {
						layer.close(index);
						window.location.reload();
					},
					end: function () {
						pearAdmin.errorVisible = false;
					}
				});
			}

			/**
			 * 菜单请求失败时的侧栏占位，提供重试入口
			 *
			 * @param error 错误对象或文本
			 */
			this.renderMenuError = function (error) {
				var detail = error && error.message ? error.message : '菜单加载失败';
				detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
				$('#side').html(
					'<div class="pear-menu-error" style="padding:18px 16px;line-height:1.9;font-size:13px;">' +
					'<p style="color:#e6a23c;">菜单加载失败</p>' +
					'<p style="color:#9a9a9a;font-size:12px;">' + escapeHtml(detail) + '</p>' +
					'<a href="javascript:;" class="pear-menu-retry" style="color:var(--global-primary-color);font-size:12px;">重新加载</a>' +
					'</div>'
				);
			}

			/**
			 * 兜底：初始化流程异常或请求悬挂时，强制结束 loading
			 *
			 * @param ms 等待时长，默认 10 秒
			 */
			this.startLoaderGuard = function (ms) {
				if (pearAdmin.loaderGuard) {
					clearTimeout(pearAdmin.loaderGuard);
				}
				var wait = typeof ms === 'number' && ms > 0 ? ms : 10000;
				pearAdmin.loaderGuard = setTimeout(function () {
					var loader = $('.loader-wrapper');
					if (loader.length && loader.is(':visible')) {
						logError('首屏加载超时', '超过 ' + wait + 'ms 仍未完成初始化，已强制结束 loading');
						loader.fadeOut(200);
					}
				}, wait);
			}

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
						timeout: 8000,
						success: (result) => {
							resolve(result);
						},
						error: (xhr, status) => {
							if (status === 'timeout') {
								reject(new Error('配置文件加载失败（请求超时）'));
							} else if (status === 'parsererror') {
								reject(new Error('配置文件加载失败（不是有效的 JSON）'));
							} else if (!xhr || !xhr.status) {
								reject(new Error('配置文件加载失败（网络不可达）'));
							} else {
								reject(new Error('配置文件加载失败（HTTP ' + xhr.status + '）'));
							}
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
				pearAdmin.startLoaderGuard();

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
						pearAdmin.reportError('配置加载失败', error);
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
					window.adminDebug.setConfig(configuration && configuration.debug === true);
				}

				if (!configuration || typeof configuration !== 'object') {
					pearAdmin.reportError('配置加载失败', '配置文件内容为空或格式错误');
					pearAdmin.keepLoad(null);
					return;
				}

				var missing = [];
				$.each(['logo', 'menu', 'tab', 'theme'], function (i, key) {
					if (!configuration[key]) {
						missing.push(key);
					}
				});
				if (missing.length) {
					pearAdmin.reportError('配置加载失败', 'pear.config.json 缺少字段：' + missing.join('、'));
					pearAdmin.keepLoad(configuration);
					return;
				}

				var kept = false;
				try {
					pearAdmin.logoRender(configuration);
					pearAdmin.menuRender(configuration);
					pearAdmin.bodyRender(configuration);
					try {
						pearAdmin.themeRender(configuration);
					} catch (themeError) {
						logError('主题初始化失败', themeError);
					}
					pearAdmin.keepLoad(configuration);
					kept = true;
					window.PearAdmin = pearAdmin;
				} catch (error) {
					pearAdmin.reportError('初始化失败', error);
				} finally {
					if (!kept) {
						pearAdmin.keepLoad(configuration);
					}
				}
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
				pearAdmin.menuReady = new Promise(function (resolve) {
					var settled = false;

					function finish() {
						if (settled) {
							return;
						}
						settled = true;
						resolve();
					}

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
						error: function (error) {
							logError('菜单加载失败', error);
							pearAdmin.renderMenuError(error);
							finish();
						},
						done: function () {
							finish();
							pearAdmin.instances.menu.isCollapse = param.menu.collapse;
							pearAdmin.instances.menu.selectItem(param.menu.select);
							if (param.menu.collapse) {
								if ($(window).width() >= 768) {
									collapse()
								}
							}
						}
					});
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
						layer.open({ type: 2, title: escapeHtml(data.menuTitle), content: data.menuUrl, area: ['80%', '80%'], maxmin: true })
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

				var $active = $("#content .layui-tab-content .layui-show");
				var frame = $active.find("iframe").get(0);
				if (!$active.length) {
					frame = $("#content iframe").get(0);
				}
				pearAdmin.frameReady = waitFrameLoad(frame);
			}

			this.keepLoad = function (param) {
				compatible();

				var other = (param && param.other) || {};
				var maxWait = typeof other.keepLoad === "number" && other.keepLoad > 0 ? other.keepLoad : 3000;
				var timer = null;

				var timeout = new Promise(function (resolve) {
					timer = setTimeout(resolve, maxWait);
				});

				function done() {
					if (timer) {
						clearTimeout(timer);
					}
					if (pearAdmin.loaderGuard) {
						clearTimeout(pearAdmin.loaderGuard);
						pearAdmin.loaderGuard = null;
					}
					pearAdmin.hideLoader();
				}

				Promise.race([
					Promise.all([pearAdmin.menuReady, pearAdmin.frameReady]),
					timeout
				]).then(done, done);
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
			if (!pearAdmin.instances.menu) {
				return;
			}
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

		body.on("click", ".pear-menu-retry", function () {
			window.location.reload();
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