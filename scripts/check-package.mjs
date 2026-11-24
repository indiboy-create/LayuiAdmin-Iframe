import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const lock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'));

function fail(message) {
	throw new Error(`包内容校验失败：${message}`);
}

const lockRoot = lock.packages?.[''];
if (!lockRoot) {
	fail('package-lock.json 缺少根包信息');
}
if (lockRoot.name !== pkg.name || lockRoot.version !== pkg.version) {
	fail(
		`package-lock.json 与 package.json 不一致：` +
			`${lockRoot.name}@${lockRoot.version} != ${pkg.name}@${pkg.version}`
	);
}

const output = execSync('npm pack --dry-run --json', {
	cwd: root,
	encoding: 'utf8',
	stdio: ['ignore', 'pipe', 'pipe'],
});
const start = output.indexOf('[');
const end = output.lastIndexOf(']');
if (start < 0 || end <= start) {
	fail('npm pack 未返回可解析的 JSON');
}

const manifest = JSON.parse(output.slice(start, end + 1))[0];
if (!manifest) {
	fail('npm pack 返回空结果');
}
if (manifest.name !== pkg.name) {
	fail(`包名不一致：期望 ${pkg.name}，实际 ${manifest.name}`);
}
if (manifest.version !== pkg.version) {
	fail(`版本不一致：期望 ${pkg.version}，实际 ${manifest.version}`);
}

const files = (manifest.files || []).map((file) => file.path);
const required = [
	'package.json',
	'README.md',
	'LICENSE',
	'dist/index.html',
	'dist/login.html',
	'dist/404.html',
	'dist/admin/config/mytsa.config.json',
	'dist/api/menu.json',
];
for (const path of required) {
	if (!files.includes(path)) {
		fail(`缺少必需文件 ${path}`);
	}
}

const forbidden = files.filter(
	(path) =>
		path === 'dist-debug' ||
		path.startsWith('dist-debug/') ||
		path.startsWith('src/') ||
		path.startsWith('test/') ||
		path.startsWith('node_modules/') ||
		path.endsWith('.tgz')
);
if (forbidden.length) {
	fail(`包含不应发布的文件：${forbidden.join('、')}`);
}

// 防止依赖回归导致包体悄悄膨胀；当前约 460 KB，留出合理余量
if (manifest.size > 600 * 1024) {
	fail(`包体 ${manifest.size} 字节超过 600 KB 上限`);
}

console.log(
	`包内容校验通过：${manifest.name}@${manifest.version}，${files.length} 个文件，` +
		`${manifest.size} 字节（解压 ${manifest.unpackedSize} 字节）`
);
