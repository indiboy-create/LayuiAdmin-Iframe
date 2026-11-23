import js from '@eslint/js';
import globals from 'globals';

export default [
	{
		// 忽略第三方/构建产物/缓存
		ignores: [
			'node_modules/**',
			'dist/**',
			'src/component/**',
			'src/admin/plugin/**',
			'.codeartsdoer/**',
		],
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
	},
];
