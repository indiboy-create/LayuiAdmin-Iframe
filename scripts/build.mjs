import { cp } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	stampMytsaBuild,
	stampHtmlAssets,
	stampConfiguration,
	stampMenuData,
	getMenuDataUrl,
	hashTree,
	hashFile,
} from './lib/build/stamp.mjs';
import { bundleMytsaCss, bundleAdminCss } from './lib/build/bundle-css.mjs';
import { minify } from './lib/build/minify.mjs';
import { removePathWithRetry, replaceDirectory } from './lib/build/replace.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'src');

const target = resolve(root, 'dist');

// 构建到临时目录，全部成功后再原子替换，避免中断留下半成品
const staging = `${target}.tmp`;
await removePathWithRetry(staging);
await cp(src, staging, { recursive: true });

try {
	await stampMytsaBuild(staging);
	await bundleMytsaCss(staging);
	await bundleAdminCss(staging);
	await minify(staging);

	// 以最终产物内容计算每文件哈希，HTML 引用的资源按各自内容加戳
	const assetHashes = await hashTree(staging);
	await stampHtmlAssets(staging, assetHashes);

	// HTML 加戳后内容已变化，重新计算页面哈希，供菜单 href 使用
	const pageHashes = await hashTree(staging);
	const menuDataUrl = await getMenuDataUrl(staging);
	const isLocalMenu =
		typeof menuDataUrl === 'string' &&
		/\.json(?:$|[?#])/i.test(menuDataUrl) &&
		!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(menuDataUrl);
	if (isLocalMenu) {
		await stampMenuData(staging, pageHashes, menuDataUrl);
		const menuKey = menuDataUrl.split(/[?#]/)[0].replace(/^\/+/, '');
		const menuPath = join(staging, ...menuKey.split('/'));
		pageHashes.set(menuKey, await hashFile(menuPath));
		await stampConfiguration(staging, pageHashes);
	}
} catch (error) {
	await removePathWithRetry(staging).catch(() => {});
	throw error;
}

await replaceDirectory(staging, target);

console.log(`构建完成（已压缩）：${target}`);
