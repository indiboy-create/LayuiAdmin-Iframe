(function (window) {
	'use strict';

	/**
	 * 后台入口鉴权：只负责读取会话、拦截未登录访问和退出登录。
	 * 登录逻辑独立在 component/login/js/auth.js，两套资源互不依赖。
	 */
	var SESSION_KEY = 'mytsa-admin-session';

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

	function clearSession() {
		try {
			window.sessionStorage.removeItem(SESSION_KEY);
			window.localStorage.removeItem(SESSION_KEY);
		} catch (error) {
			// 忽略
		}
	}

	function isValid(session) {
		return !!(session && session.expiresAt && session.expiresAt > Date.now());
	}

	function session() {
		var current = readSession();
		return isValid(current) ? current : null;
	}

	function guard() {
		if (session()) {
			return true;
		}
		clearSession();
		window.location.replace('login.html');
		return false;
	}

	function logout() {
		clearSession();
		window.location.replace('login.html');
	}

	window.Auth = {
		guard: guard,
		logout: logout,
		session: session,
	};

	var currentScript = document.currentScript;
	if (currentScript && currentScript.hasAttribute && currentScript.hasAttribute('data-guard')) {
		guard();
	}
})(window);
