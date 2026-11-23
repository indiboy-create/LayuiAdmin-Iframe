import { readFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exists, walk, findMissingReferences, validateThemeConfig } from './lib/validate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dist = resolve(root, 'dist');

// 构建产物必须包含的入口与核心资源
const REQUIRED_FILES = [
	'index.html',
	'login.html',
	'home.html',
	'table.html',
	'component/layui/layui.js',
	'component/pear/pear.js',
	'component/pear/module/theme.js',
	'component/pear/module/admin.js',
	'component/pear/module/menu.js',
	'component/pear/module/tabPage.js',
	'component/pear/css/pear.css',
	'admin/js/debug.js',
	'admin/js/bootstrap.js',
	'admin/js/login.js',
	'admin/config/pear.config.json',
	'api/menu.json',
];

const CONFIG_PATH = 'admin/config/pear.config.json';

const errors = [];

if (!(await exists(dist))) {
	console.error('::error::未找到构建产物 dist/，请先执行 npm run build');
	process.exit(1);
}

for (const file of REQUIRED_FILES) {
	if (!(await exists(join(dist, file)))) {
		errors.push(`缺少必要文件：${file}`);
	}
}

const files = await walk(dist);
const htmlFiles = files.filter((file) => extname(file).toLowerCase() === '.html');
const cssFiles = files.filter((file) => extname(file).toLowerCase() === '.css');
const jsonFiles = files.filter((file) => extname(file).toLowerCase() === '.json');

errors.push(...(await findMissingReferences({ rootDir: dist, files: htmlFiles, kind: 'html' })));
errors.push(...(await findMissingReferences({ rootDir: dist, files: cssFiles, kind: 'css' })));

let config = null;
for (const jsonFile of jsonFiles) {
	const label = pathLabel(jsonFile);
	try {
		const parsed = JSON.parse(await readFile(jsonFile, 'utf8'));
		if (label === CONFIG_PATH) {
			config = parsed;
		}
	} catch (error) {
		errors.push(`${label} JSON 解析失败：${error.message}`);
	}
}

if (config) {
	validateThemeConfig(config, CONFIG_PATH, errors);
}

function pathLabel(file) {
	return file.slice(dist.length + 1).replace(/\\/g, '/');
}

if (errors.length) {
	for (const message of errors) {
		console.error(`::error::${message}`);
	}
	process.exit(1);
}

console.log(
	`检查通过：${htmlFiles.length} 个 HTML、${cssFiles.length} 个 CSS、${jsonFiles.length} 个 JSON，${REQUIRED_FILES.length} 个必要文件`
);
