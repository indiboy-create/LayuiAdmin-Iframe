layui.define(['jquery'], function (exports) {
	'use strict';

	var $ = layui.jquery;
	var DEFAULTS = {
		tokenKey: 'mytsa_token',
		storage: 'session',
		header: 'Authorization',
		scheme: 'Bearer',
		baseURL: '',
		timeout: 8000,
		withCredentials: false,
		headers: {},
		unauthorizedRedirect: '',
		provider: null,
		onUnauthorized: null,
		refresh: null,
	};
	var state = Object.assign({}, DEFAULTS);

	function readStorage() {
		if (state.storage !== 'session') {
			return '';
		}
		try {
			return String(window.sessionStorage.getItem(state.tokenKey) || '');
		} catch (error) {
			return '';
		}
	}

	function writeStorage(token) {
		if (state.storage !== 'session') {
			return;
		}
		try {
			if (token) {
				window.sessionStorage.setItem(state.tokenKey, token);
			} else {
				window.sessionStorage.removeItem(state.tokenKey);
			}
		} catch (error) {
			state.token = token || '';
		}
	}

	function clearToken() {
		state.token = '';
		writeStorage('');
		return api;
	}

	function setToken(token, persist) {
		var value = token === undefined || token === null ? '' : String(token).trim();
		state.token = value;
		writeStorage(persist === false ? '' : value);
		return api;
	}

	function getToken() {
		if (state.token) {
			return state.token;
		}
		state.token = readStorage();
		return state.token;
	}

	function resolveToken() {
		if (typeof state.provider === 'function') {
			try {
				var provided = state.provider();
				if (provided && typeof provided.then === 'function') {
					return provided.then(function (token) {
						return token ? String(token).trim() : getToken();
					});
				}
				if (provided) {
					return String(provided).trim();
				}
			} catch (error) {
				return getToken();
			}
		}
		return getToken();
	}

	function authValue(token) {
		var scheme = String(state.scheme || '').trim();
		if (!scheme) {
			return token;
		}
		var prefix = scheme.toLowerCase() + ' ';
		return token.toLowerCase().indexOf(prefix) === 0 ? token : scheme + ' ' + token;
	}

	function buildUrl(url) {
		var value = String(url || '');
		if (!state.baseURL || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) {
			return value;
		}
		return String(state.baseURL).replace(/\/+$/, '') + '/' + value.replace(/^\/+/, '');
	}

	function parseData(xhr) {
		if (!xhr) {
			return null;
		}
		if (xhr.responseJSON !== undefined) {
			return xhr.responseJSON;
		}
		try {
			return JSON.parse(xhr.responseText);
		} catch (error) {
			return null;
		}
	}

	function makeError(xhr, textStatus, errorThrown, config) {
		var data = parseData(xhr);
		var message =
			(data && (data.message || data.msg)) ||
			(errorThrown && errorThrown.message) ||
			errorThrown ||
			textStatus ||
			'请求失败';
		var error = new Error(message);
		error.status = xhr && xhr.status;
		error.data = data;
		error.textStatus = textStatus;
		error.xhr = xhr;
		error.config = config;
		return error;
	}

	function redirectToLogin() {
		if (state.unauthorizedRedirect && window.location) {
			window.location.href = state.unauthorizedRedirect;
		}
	}

	function handleError(error, config, resolve, reject) {
		if (!(error.xhr && error.xhr.status === 401) || config._retry) {
			reject(error);
			return;
		}

		clearToken();
		if (typeof state.onUnauthorized === 'function') {
			try {
				state.onUnauthorized(error, config);
			} catch (callbackError) {
				reject(callbackError);
				return;
			}
		}

		var task = typeof state.refresh === 'function' ? state.refresh(error, config) : null;
		var retry = Object.assign({}, config, { _retry: true });

		if (task && typeof task.then === 'function') {
			task.then(
				function (token) {
					if (token) {
						setToken(token);
						request(retry).then(resolve, reject);
						return;
					}
					redirectToLogin();
					reject(error);
				},
				function () {
					redirectToLogin();
					reject(error);
				}
			);
			return;
		}

		if (typeof task === 'string' && task) {
			setToken(task);
			request(retry).then(resolve, reject);
			return;
		}

		redirectToLogin();
		reject(error);
	}

	function request(options) {
		var config = options || {};
		if (typeof config === 'string') {
			config = { url: config };
		}
		if (!config.url) {
			return Promise.reject(new Error('请求地址不能为空'));
		}

		var useAuth = config.withAuth !== false && config.skipAuth !== true;
		var credentials =
			config.withCredentials === undefined ? state.withCredentials : config.withCredentials;
		var settings = {
			url: buildUrl(config.url),
			type: String(config.method || config.type || 'GET').toUpperCase(),
			data: config.data,
			dataType: config.dataType || 'json',
			timeout: config.timeout === undefined ? state.timeout : config.timeout,
			contentType: config.contentType,
			processData: config.processData,
			traditional: config.traditional,
			cache: config.cache,
			headers: Object.assign({}, state.headers, config.headers || {}),
		};

		if (credentials) {
			settings.xhrFields = { withCredentials: true };
		}

		return Promise.resolve()
			.then(function () {
				return useAuth ? resolveToken() : '';
			})
			.then(function (token) {
				if (useAuth && token) {
					settings.headers[state.header] = authValue(token);
				}
				return new Promise(function (resolve, reject) {
					settings.success = function (data, textStatus, xhr) {
						resolve({
							data: data,
							status: xhr && xhr.status,
							textStatus: textStatus,
							headers:
								xhr && xhr.getAllResponseHeaders ? xhr.getAllResponseHeaders() : '',
							xhr: xhr,
						});
					};
					settings.error = function (xhr, textStatus, thrown) {
						handleError(
							makeError(xhr, textStatus, thrown, config),
							config,
							resolve,
							reject
						);
					};
					$.ajax(settings);
				});
			});
	}

	function method(methodName) {
		return function (url, data, options) {
			var config =
				url && typeof url === 'object'
					? Object.assign({}, url, { method: methodName })
					: Object.assign({}, options, { url: url, data: data, method: methodName });
			return request(config);
		};
	}

	var api = {
		request: request,
		get: method('GET'),
		post: method('POST'),
		put: method('PUT'),
		patch: method('PATCH'),
		del: method('DELETE'),
		configure: function (options) {
			if (!options || typeof options !== 'object') {
				return api;
			}
			Object.keys(DEFAULTS).forEach(function (key) {
				if (Object.prototype.hasOwnProperty.call(options, key)) {
					if (key === 'headers') {
						state.headers = Object.assign({}, state.headers, options.headers || {});
					} else {
						state[key] = options[key];
					}
				}
			});
			return api;
		},
		setToken: setToken,
		getToken: getToken,
		clearToken: clearToken,
		setTokenProvider: function (provider) {
			state.provider = typeof provider === 'function' ? provider : null;
			return api;
		},
		setUnauthorizedHandler: function (handler) {
			state.onUnauthorized = typeof handler === 'function' ? handler : null;
			return api;
		},
		setRefreshHandler: function (handler) {
			state.refresh = typeof handler === 'function' ? handler : null;
			return api;
		},
	};

	exports('http', api);
});
