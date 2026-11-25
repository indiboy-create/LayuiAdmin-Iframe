import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { walk, exists, shownPath } from './fs-utils.mjs';

export { walk, exists, shownPath };

// 外部链接、锚点、脚本协议等无需校验
export const SKIP_PATTERN = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

// CSS url() 中的变量与模板占位符无需校验
export const SKIP_URL_PATTERN = /^(?:var\(|\$\{)/i;

export const SCHEME_FIELDS = ['id', 'label'];

export const SCHEME_COLOR_FIELDS = ['base', 'header', 'headerText', 'logo', 'tab', 'selected'];

const REFERENCE_PATTERN = {
	html: /\b(?:src|href)\s*=\s*["']([^"']+)["']/gi,
	css: /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi,
};

export async function findMissingReferences({ rootDir, files, kind }) {
	const pattern = REFERENCE_PATTERN[kind];
	if (!pattern) {
		throw new Error(`不支持的引用类型：${kind}`);
	}

	const errors = [];
	const valueIndex = kind === 'css' ? 2 : 1;

	for (const file of files) {
		const content = await readFile(file, 'utf8');
		for (const match of content.matchAll(new RegExp(pattern.source, pattern.flags))) {
			const raw = String(match[valueIndex]).trim();
			if (!raw || SKIP_PATTERN.test(raw) || SKIP_URL_PATTERN.test(raw)) continue;

			const clean = raw.split('#')[0].split('?')[0].trim();
			if (!clean) continue;

			const target = clean.startsWith('/')
				? resolve(rootDir, clean.slice(1))
				: resolve(dirname(file), clean);

			if (!(await exists(target))) {
				errors.push(`${shownPath(rootDir, file)} 引用的资源不存在：${raw}`);
			}
		}
	}

	return errors;
}

export function collectLeafMenus(items, leaves = []) {
	for (const item of items) {
		if (item.type === 1) {
			leaves.push(item);
		}
		if (item.children) {
			collectLeafMenus(item.children, leaves);
		}
	}
	return leaves;
}

export function validateThemeConfig(config, configPath, errors) {
	if (!config.menu || typeof config.menu !== 'object') {
		errors.push(`${configPath} 缺少 menu 配置`);
	}
	if (!config.theme || typeof config.theme !== 'object') {
		errors.push(`${configPath} 缺少 theme 配置`);
	}
	if (!Array.isArray(config.colors) || !config.colors.length) {
		errors.push(`${configPath} 的 colors 必须是非空数组`);
		return;
	}

	const colorIds = new Set();
	const colorValues = new Set();
	for (const [index, color] of config.colors.entries()) {
		if (!color.id || !color.selected) {
			errors.push(`${configPath} 的 colors[${index}] 缺少 id 或 selected`);
		}
		for (const field of ['selected', 'tab', 'header']) {
			if (color[field] !== undefined && typeof color[field] !== 'string') {
				errors.push(`${configPath} 的 colors[${index}] 的 ${field} 应为字符串`);
			}
		}
		if (
			color.shades !== undefined &&
			(!Array.isArray(color.shades) ||
				color.shades.some((value) => typeof value !== 'string'))
		) {
			errors.push(`${configPath} 的 colors[${index}] 的 shades 应为颜色字符串数组`);
		}
		if (colorIds.has(String(color.id))) {
			errors.push(`${configPath} 的 colors 存在重复 id：${color.id}`);
		}
		colorIds.add(String(color.id));
		if (typeof color.selected === 'string') {
			colorValues.add(color.selected.toLowerCase());
		}
	}

	const theme = config.theme || {};
	if (theme.defaultColor !== undefined && !colorIds.has(String(theme.defaultColor))) {
		errors.push(`${configPath} 的 theme.defaultColor=${theme.defaultColor} 未在 colors 中找到`);
	}
	if (!Array.isArray(theme.schemes) || !theme.schemes.length) {
		errors.push(`${configPath} 的 theme.schemes 必须是非空数组`);
		return;
	}

	const schemeIds = new Set();
	const schemeLabels = new Set();
	for (const [index, scheme] of theme.schemes.entries()) {
		for (const field of SCHEME_FIELDS) {
			if (!scheme[field]) {
				errors.push(`${configPath} 的 theme.schemes[${index}] 缺少 ${field}`);
			}
		}
		for (const field of SCHEME_COLOR_FIELDS) {
			if (scheme[field] !== undefined && typeof scheme[field] !== 'string') {
				errors.push(`${configPath} 的 theme.schemes[${index}] 的 ${field} 应为字符串`);
			}
		}
		if (
			typeof scheme.selected === 'string' &&
			scheme.selected !== '' &&
			!colorValues.has(scheme.selected.toLowerCase())
		) {
			errors.push(
				`${configPath} 的 theme.schemes[${index}] 的 selected=${scheme.selected} 未在 colors 中找到`
			);
		}
		if (schemeIds.has(String(scheme.id))) {
			errors.push(`${configPath} 的 theme.schemes 存在重复 id：${scheme.id}`);
		}
		schemeIds.add(String(scheme.id));
		if (schemeLabels.has(scheme.label)) {
			errors.push(`${configPath} 的 theme.schemes 存在重复 label：${scheme.label}`);
		}
		schemeLabels.add(scheme.label);
	}

	if (theme.defaultScheme !== undefined && !schemeIds.has(String(theme.defaultScheme))) {
		errors.push(
			`${configPath} 的 theme.defaultScheme=${theme.defaultScheme} 未在 schemes 中找到`
		);
	}
}
export function validateRuntimeConfig(config, configPath, errors) {
	if (config.tab && config.tab.max !== undefined && typeof config.tab.max !== 'number') {
		errors.push(`${configPath} 的 tab.max 应为数字`);
	}
	if (
		config.other &&
		config.other.keepLoad !== undefined &&
		typeof config.other.keepLoad !== 'number'
	) {
		errors.push(`${configPath} 的 other.keepLoad 应为数字`);
	}
}
