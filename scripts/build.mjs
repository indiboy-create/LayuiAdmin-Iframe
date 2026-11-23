import { cp, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampPearBuild, stampHtmlAssets } from './lib/build/stamp.mjs';
import { bundlePearCss } from './lib/build/bundle-css.mjs';
import { stripDebugAssets } from './lib/build/strip-debug.mjs';
import { minify } from './lib/build/minify.mjs';
import { setDebugConfig } from './lib/build/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'src');

// 可调试构建：跳过压缩，输出源码级可读产物（默认输出到 dist-debug）
const noMinify = process.argv.includes('--no-minify');
const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const target = resolve(
	root,
	outArg ? outArg.slice('--out='.length) : noMinify ? 'dist-debug' : 'dist'
);

// 构建到临时目录，全部成功后再原子替换，避免中断留下半成品
const staging = `${target}.tmp`;
await rm(staging, { recursive: true, force: true });
await cp(src, staging, { recursive: true });

try {
	const buildStamp = await stampPearBuild(staging);
	await bundlePearCss(staging);
	if (!noMinify) {
		await stripDebugAssets(staging);
	}
	await stampHtmlAssets(staging, buildStamp);
	// 正式构建强制关闭调试，避免调试日志进入线上产物
	await setDebugConfig(staging, noMinify);
	if (!noMinify) {
		await minify(staging);
	}
} catch (error) {
	await rm(staging, { recursive: true, force: true });
	throw error;
}

await rm(target, { recursive: true, force: true });
await rename(staging, target);

console.log(
	noMinify
		? `构建完成（未压缩，保留调试模块）：${target}`
		: `构建完成（已压缩，已移除调试模块）：${target}`
);
