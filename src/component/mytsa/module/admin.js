layui.define(['jquery', 'element', 'layer', 'tabPage', 'menu', 'theme'], function (exports) {
	'use strict';

	var $ = layui.jquery,
		layer = layui.layer,
		menu = layui.menu,
		tabPage = layui.tabPage,
		theme = layui.theme;

	var logout = function () {};

	var body = $('body');

	function escapeHtml(value) {
		return String(value === undefined || value === null ? '' : value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// 给 iframe 地址追加站点标识，子页据此读取同站点的主题缓存
	function appendScope(url, scope) {
		var value = String(url || '');
		if (
			!scope ||
			/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value) ||
			/[?&]mytsa_scope=/.test(value)
		) {
			return value;
		}
		var hash = '';
		var hashIndex = value.indexOf('#');
		if (hashIndex >= 0) {
			hash = value.slice(hashIndex);
			value = value.slice(0, hashIndex);
		}
		var sep = value.indexOf('?') >= 0 ? '&' : '?';
		return value + sep + 'mytsa_scope=' + encodeURIComponent(scope) + hash;
	}

	// 浏览器标签标题跟随当前激活的标签页，多开时便于区分
	var baseTitle = document.title;

	function updateDocumentTitle() {
		// 关闭标签的瞬间 layui-this 可能短暂同时挂在两个 li 上，取最后一个
		var $active = $('.layui-tab-title li.layui-this').last().find('span.title');
		var title = $active.length ? $active.first().text().trim() : '';
		document.title = title ? title + ' - ' + baseTitle : baseTitle;
	}

	function logError(title, error) {
		var detail = error && error.message ? error.message : String(error || '');
		var message = (title ? title + '：' : '') + detail;
		if (window.console && window.console.error) {
			window.console.error('[admin] ' + message);
		}
	}

	function isFrameLoaded(frame) {
		try {
			return frame.contentDocument && frame.contentDocument.readyState === 'complete';
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
			frame.addEventListener('load', resolve, { once: true });
		});
	}

	var mytsaAdmin = new (function () {
		this.configuration = {};

		this.configurationPath = 'api/mytsa.config.json';

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
		};

		/**
		 * 初始化阶段的致命错误：结束 loading 并给出可重试的提示
		 *
		 * @param title 标题
		 * @param error 错误对象或文本
		 */
		this.reportError = function (title, error) {
			var detail = error && error.message ? error.message : String(error || '未知错误');
			detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
			mytsaAdmin.hideLoader();
			logError(title, error);

			if (mytsaAdmin.errorVisible) {
				return;
			}
			if (!layer || typeof layer.open !== 'function') {
				window.alert(title + '：' + detail);
				return;
			}
			mytsaAdmin.errorVisible = true;
			layer.open({
				type: 1,
				title: escapeHtml(title),
				area: [Math.min(420, Math.max(280, window.innerWidth - 40)) + 'px', 'auto'],
				shade: 0.3,
				content:
					'<div style="padding:18px 20px;line-height:1.8;">' +
					'<p style="color:#666;">' +
					escapeHtml(detail) +
					'</p>' +
					'<p style="color:#999;font-size:12px;">请检查配置文件与接口是否可访问，或点击下方按钮重试。</p>' +
					'</div>',
				btn: ['重新加载'],
				yes: function (index) {
					layer.close(index);
					window.location.reload();
				},
				end: function () {
					mytsaAdmin.errorVisible = false;
				},
			});
		};

		/**
		 * 菜单请求失败时的侧栏占位，提供重试入口
		 *
		 * @param error 错误对象或文本
		 */
		this.renderMenuError = function (error) {
			var detail = error && error.message ? error.message : '菜单加载失败';
			detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
			$('#side').html(
				'<div class="mytsa-menu-error" style="padding:18px 16px;line-height:1.9;font-size:13px;">' +
					'<p style="color:#e6a23c;">菜单加载失败</p>' +
					'<p style="color:#9a9a9a;font-size:12px;">' +
					escapeHtml(detail) +
					'</p>' +
					'<a href="javascript:;" class="mytsa-menu-retry" style="color:var(--global-selected-color);font-size:12px;">重新加载</a>' +
					'</div>'
			);
		};

		/**
		 * 兜底：初始化流程异常或请求悬挂时，强制结束 loading
		 *
		 * @param ms 等待时长，默认 10 秒
		 */
		this.startLoaderGuard = function (ms) {
			if (mytsaAdmin.loaderGuard) {
				clearTimeout(mytsaAdmin.loaderGuard);
			}
			var wait = typeof ms === 'number' && ms > 0 ? ms : 10000;
			mytsaAdmin.loaderGuard = setTimeout(function () {
				var loader = $('.loader-wrapper');
				if (loader.length && loader.is(':visible')) {
					logError(
						'首屏加载超时',
						'超过 ' + wait + 'ms 仍未完成初始化，已强制结束 loading'
					);
					loader.fadeOut(200);
				}
			}, wait);
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 获取 mytsa.config 实现 [ default ]
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
					},
				});
			});
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 配置 mytsa.config 路径
		 */
		this.setConfigurationPath = (path) => {
			this.configurationPath = path;
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 获取 mytsa.config 实现 [ implement ]
		 */
		this.setConfigurationProvider = (provider) => {
			this.configurationProvider = provider;
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 获取 mytsa.config 配置
		 */
		this.getConfiguration = () => {
			return this.configuration;
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * Core Function.
		 *
		 * @param {*} options
		 */
		this.render = (options) => {
			mytsaAdmin.startLoaderGuard();

			if (options !== undefined) {
				mytsaAdmin.apply(options);
				return Promise.resolve(options);
			}
			return this.configurationProvider()
				.then((result) => {
					mytsaAdmin.apply(result);
					return result;
				})
				.catch((error) => {
					mytsaAdmin.reportError('配置加载失败', error);
					return null;
				});
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 启动构建
		 */
		this.apply = function (configuration) {
			if (!configuration || typeof configuration !== 'object') {
				mytsaAdmin.reportError('配置加载失败', '配置文件内容为空或格式错误');
				mytsaAdmin.keepLoad(null);
				return;
			}

			var missing = [];
			$.each(['logo', 'menu', 'tab', 'theme'], function (i, key) {
				if (!configuration[key]) {
					missing.push(key);
				}
			});
			if (missing.length) {
				mytsaAdmin.reportError(
					'配置加载失败',
					'mytsa.config.json 缺少字段：' + missing.join('、')
				);
				mytsaAdmin.keepLoad(configuration);
				return;
			}

			var kept = false;
			try {
				mytsaAdmin.logoRender(configuration);
				mytsaAdmin.menuRender(configuration);
				mytsaAdmin.bodyRender(configuration);
				try {
					mytsaAdmin.themeRender(configuration);
				} catch (themeError) {
					logError('主题初始化失败', themeError);
				}
				mytsaAdmin.keepLoad(configuration);
				kept = true;
				window.MytsaAdmin = mytsaAdmin;
			} catch (error) {
				mytsaAdmin.reportError('初始化失败', error);
			} finally {
				if (!kept) {
					mytsaAdmin.keepLoad(configuration);
				}
			}
		};

		this.logoRender = function (param) {
			$('.layui-logo .logo').attr('src', param.logo.image);
			$('.layui-logo .title').html(param.logo.title);
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 侧边菜单
		 */
		this.menuRender = function (param) {
			mytsaAdmin.menuReady = new Promise(function (resolve) {
				var settled = false;

				function finish() {
					if (settled) {
						return;
					}
					settled = true;
					resolve();
				}

				mytsaAdmin.instances.menu = menu.render({
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
						mytsaAdmin.renderMenuError(error);
						finish();
					},
					done: function () {
						finish();
						mytsaAdmin.instances.menu.isCollapse = param.menu.collapse;
						mytsaAdmin.instances.menu.selectItem(param.menu.select);
						if (param.menu.collapse) {
							if ($(window).width() >= 768) {
								collapse();
							}
						}
					},
				});
			});
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 视图容器
		 */
		this.bodyRender = function (param) {
			body.on('click', '.refresh', function () {
				mytsaAdmin.refresh();
			});

			mytsaAdmin.instances.tabPage = tabPage.render({
				elem: 'content',
				session: param.tab.session,
				index: 0,
				tabMax: param.tab.max,
				scope: (param.site && param.site.scope) || '',
				closeEvent: function (id) {
					mytsaAdmin.instances.menu.selectItem(id);
					// layui 关闭标签后才会切换 layui-this，等一帧再同步标题
					setTimeout(updateDocumentTitle, 200);
				},
				data: [
					{
						id: param.tab.index.id,
						url: param.tab.index.href,
						title: param.tab.index.title,
						type: param.tab.index.type,
						close: false,
					},
				],
				success: function (id) {
					if (param.tab.session) {
						setTimeout(function () {
							mytsaAdmin.instances.menu.selectItem(id);
							mytsaAdmin.instances.tabPage.positionTab();
							updateDocumentTitle();
						}, 500);
					}
				},
			});

			mytsaAdmin.instances.tabPage.click(function (id) {
				if (!param.tab.keepState) {
					mytsaAdmin.instances.tabPage.refresh(false);
				}
				mytsaAdmin.instances.tabPage.positionTab();
				mytsaAdmin.instances.menu.selectItem(id);
				updateDocumentTitle();
			});

			mytsaAdmin.instances.menu.click(function (dom, data) {
				if (data.menuOpenType === '_layer') {
					layer.open({
						type: 2,
						title: escapeHtml(data.menuTitle),
						content: appendScope(data.menuUrl, param.site && param.site.scope),
						area: ['80%', '80%'],
						maxmin: true,
					});
				} else {
					mytsaAdmin.instances.tabPage.changePage({
						id: data.menuId,
						title: data.menuTitle,
						type: data.menuOpenType,
						url: data.menuUrl,
						close: true,
					});
				}
				compatible();
			});

			var $active = $('#content .layui-tab-content .layui-show');
			var frame = $active.find('iframe').get(0);
			if (!$active.length) {
				frame = $('#content iframe').get(0);
			}
			mytsaAdmin.frameReady = waitFrameLoad(frame);
		};

		this.keepLoad = function (param) {
			compatible();

			var other = (param && param.other) || {};
			var maxWait =
				typeof other.keepLoad === 'number' && other.keepLoad > 0 ? other.keepLoad : 3000;
			var timer = null;

			var timeout = new Promise(function (resolve) {
				timer = setTimeout(resolve, maxWait);
			});

			function done() {
				if (timer) {
					clearTimeout(timer);
				}
				if (mytsaAdmin.loaderGuard) {
					clearTimeout(mytsaAdmin.loaderGuard);
					mytsaAdmin.loaderGuard = null;
				}
				mytsaAdmin.hideLoader();
			}

			Promise.race([
				Promise.all([mytsaAdmin.menuReady, mytsaAdmin.frameReady]),
				timeout,
			]).then(done, done);
		};

		/***
		 * @since MyTSA Admin 4.0
		 *
		 * 切换主题色
		 */
		this.changeTheme = function () {
			theme.changeTheme();
		};

		/**
		 * @since MyTSA Admin 4.0
		 *
		 * 主题配置
		 */
		this.themeRender = function (option) {
			theme.render(option);
		};

		/**
		 * 设置注销逻辑
		 *
		 * @param callback 实现
		 */
		this.logout = function (callback) {
			if (callback != undefined) {
				logout = callback;
			}
		};

		/**
		 * @since MyTSA Admin 4.0.3
		 *
		 * 刷新当前页面
		 */
		this.refresh = function () {
			var refreshBtn = $('.refresh a');
			refreshBtn.addClass('layui-anim layui-anim-rotate layui-anim-loop layui-icon-loading');
			refreshBtn.removeClass('layui-icon-refresh-1');
			mytsaAdmin.instances.tabPage.refresh(true);
			setTimeout(function () {
				refreshBtn.removeClass(
					'layui-anim layui-anim-rotate layui-anim-loop layui-icon-loading'
				);
				refreshBtn.addClass('layui-icon-refresh-1');
			}, 600);
		};

		/**
		 * @since MyTSA Admin 4.0.3
		 *
		 * 切换内容页面
		 *
		 * PS: tabPages 模式下，如果页面不存在则新增，反则仅做切换。
		 */
		this.changePage = function (data) {
			mytsaAdmin.instances.tabPage.changePage({
				id: data.id,
				title: data.title,
				url: data.url,
				type: data.type,
				close: true,
			});
		};
	})();

	/**
	 * @since MyTSA Admin 4.0
	 *
	 * 菜单折叠
	 */
	function collapse() {
		if (!mytsaAdmin.instances.menu) {
			return;
		}
		mytsaAdmin.instances.menu.collapse();
		var admin = $('.mytsa-admin');
		var left = $('.layui-icon-spread-left');
		var right = $('.layui-icon-shrink-right');
		if (admin.is('.mytsa-mini')) {
			left.addClass('layui-icon-shrink-right');
			left.removeClass('layui-icon-spread-left');
			admin.removeClass('mytsa-mini');
			mytsaAdmin.instances.menu.isCollapse = false;
		} else {
			right.addClass('layui-icon-spread-left');
			right.removeClass('layui-icon-shrink-right');
			admin.addClass('mytsa-mini');
			mytsaAdmin.instances.menu.isCollapse = true;
		}
	}

	/**
	 * @since MyTSA Admin 4.0
	 *
	 * 使用 admin.logout(Function) 实现注销
	 *
	 * Promise<boolean> 作为返回值类型时，泛型内容为 true 时视为注销成功，则清除 mytsaAdmin.instances.tabPage 缓存
	 *
	 * 否则视为注销失败，不做任何处置。
	 */
	body.on('click', '.logout', function () {
		var promise = logout();
		if (promise != undefined) {
			promise.then((asyncResult) => {
				if (asyncResult) {
					if (mytsaAdmin.instances.tabPage != undefined) {
						mytsaAdmin.instances.tabPage.clear();
					}
				}
			});
		} else {
			if (mytsaAdmin.instances.tabPage != undefined) {
				mytsaAdmin.instances.tabPage.clear();
			}
		}
	});

	body.on('click', '.collapse,.mytsa-cover', function () {
		collapse();
	});

	body.on('click', '.mytsa-menu-retry', function () {
		window.location.reload();
	});

	body.on('click', '[user-menu-id]', function () {
		mytsaAdmin.instances.tabPage.changePage(
			{
				id: $(this).attr('user-menu-id'),
				title: $(this).attr('user-menu-title'),
				url: $(this).attr('user-menu-url'),
				close: true,
			},
			300
		);
	});

	function compatible() {
		if ($(window).width() <= 768) {
			collapse();
		}
	}

	$(window).on(
		'resize',
		layui.debounce(function () {
			if (
				mytsaAdmin.instances.menu &&
				!mytsaAdmin.instances.menu.isCollapse &&
				$(window).width() <= 768
			) {
				collapse();
			}
		}, 50)
	);

	exports('admin', mytsaAdmin);
});
