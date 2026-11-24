try {
	if (window.self !== window.top) {
		window.top.location.reload();
	}
} catch {
	// 跨域顶层窗口不可访问时忽略
}
