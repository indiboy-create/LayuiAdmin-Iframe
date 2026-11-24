layui.define(function (exports) {
	'use strict';

	/**
	 * 登录模块：读取 api/auth.json、校验账号密码并写入会话。
	 * 账号密码明文存储，仅用于演示；真实项目必须由后端签发凭证。
	 */
	var AUTH_URL = 'api/auth.json';
	var SESSION_KEY = 'mytsa-admin-session';
	var DEFAULT_HOURS = 8;
	var DEFAULT_REMEMBER_HOURS = 168;

	function readSession() {
		try {
			var raw =
				window.sessionStorage.getItem(SESSION_KEY) ||
				window.localStorage.getItem(SESSION_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (error) {
			return null;
		}
	}

	function writeSession(session, remember) {
		var text = JSON.stringify(session);
		try {
			if (remember) {
				window.localStorage.setItem(SESSION_KEY, text);
				window.sessionStorage.removeItem(SESSION_KEY);
			} else {
				window.sessionStorage.setItem(SESSION_KEY, text);
				window.localStorage.removeItem(SESSION_KEY);
			}
		} catch (error) {
			// 存储不可用（隐私模式等）时忽略，仅本次会话失效
		}
	}

	function isValid(session) {
		return !!(session && session.expiresAt && session.expiresAt > Date.now());
	}

	function session() {
		var current = readSession();
		return isValid(current) ? current : null;
	}

	function guardLoginPage() {
		if (session()) {
			window.location.replace('index.html');
			return false;
		}
		return true;
	}

	function login(username, password, remember) {
		username = String(username == null ? '' : username).trim();
		password = String(password == null ? '' : password);

		if (!username || !password) {
			return Promise.reject(new Error('请输入账号和密码'));
		}

		return fetch(AUTH_URL, { cache: 'no-store' })
			.then(function (response) {
				if (!response.ok) {
					throw new Error('账号配置加载失败（HTTP ' + response.status + '）');
				}
				return response.json();
			})
			.then(
				function (config) {
					var users = config && Array.isArray(config.users) ? config.users : [];
					var matched = null;

					for (var i = 0; i < users.length; i++) {
						if (users[i].username === username && users[i].password === password) {
							matched = users[i];
							break;
						}
					}

					if (!matched) {
						throw new Error('账号或密码错误');
					}

					var hours = remember
						? config.rememberHours || DEFAULT_REMEMBER_HOURS
						: config.sessionHours || DEFAULT_HOURS;

					var next = {
						username: matched.username,
						name: matched.name || matched.username,
						role: matched.role || 'user',
						expiresAt: Date.now() + hours * 60 * 60 * 1000,
					};

					writeSession(next, !!remember);
					return next;
				},
				function () {
					throw new Error('账号配置加载失败，请检查网络后重试');
				}
			);
	}

	if (document.querySelector('script[data-guard-login]')) {
		guardLoginPage();
	}

	exports('auth', {
		login: login,
		guardLoginPage: guardLoginPage,
		session: session,
	});
});
