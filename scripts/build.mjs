import { cp, rm } from 'node:fs/promises';
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
const dist = resolve(
	root,
	outArg ? outArg.slice('--out='.length) : noMinify ? 'dist-debug' : 'dist'
);

// 清空旧产物 -> 整体拷贝 -> 注入构建标记 -> 合并样式 -> 剥离调试 -> 压缩
await rm(dist, { recursive: true, force: true });
await cp(src, dist, { recursive: true });

const buildStamp = await stampPearBuild(dist);
await bundlePearCss(dist);
if (!noMinify) {
	await stripDebugAssets(dist);
}
await stampHtmlAssets(dist, buildStamp);

// 正式构建强制关闭调试，避免调试日志进入线上产物
await setDebugConfig(dist, noMinify);

if (!noMinify) {
	await minify(dist);
}

console.log(
	noMinify
		? `构建完成（未压缩，保留调试模块）：${dist}`
		: `构建完成（已压缩，已移除调试模块）：${dist}`
);
