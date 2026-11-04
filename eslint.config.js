import js from '@eslint/js';
import globals from 'globals';

export default [
	{
		// 忽略第三方/构建产物/缓存
		ignores: ['node_modules/**', 'dist/**', 'src/component/**'],
	},
	js.configs.recommended,
	{
		files: ['**/*.{js,mjs,cjs}'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.browser,
				...globals.node,
				layui: 'readonly',
				layer: 'readonly',
				gwm: 'readonly',
			},
		},
		rules: {
			// 既有代码为全局/AMD 风格，先放开这些规则，避免旧代码被误报；
			// 新代码可逐步收紧。
			'no-unused-vars': 'off',
			'no-undef': 'off',
			'no-redeclare': 'off',
			'no-useless-assignment': 'off',
		},
	},
];
