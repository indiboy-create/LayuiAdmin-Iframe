import { rename, rm, stat } from 'node:fs/promises';

// Windows 下 dist 经常被编辑器、资源管理器或正在运行的预览进程短暂占用，
// 直接 rm / rename 会抛 EPERM、EBUSY 等错误。这里对这些错误做有限次退避重试。
const RETRY_DELAYS = [120, 240, 480, 960, 1920];
const RETRYABLE_CODES = new Set(['EPERM', 'EBUSY', 'ENOTEMPTY', 'EACCES', 'ETXTBSY']);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pathExists(target) {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

export async function withRetry(action, label, attempts = RETRY_DELAYS.length + 1) {
	let lastError = null;
	for (let i = 0; i < attempts; i += 1) {
		try {
			return await action();
		} catch (error) {
			lastError = error;
			if (!RETRYABLE_CODES.has(error.code) || i === attempts - 1) {
				break;
			}
			await wait(RETRY_DELAYS[Math.min(i, RETRY_DELAYS.length - 1)]);
		}
	}
	if (lastError) {
		lastError.message = `${label}失败：${lastError.message}`;
		throw lastError;
	}
}

export async function removePathWithRetry(target) {
	await withRetry(() => rm(target, { recursive: true, force: true }), `清理 ${target}`);
}

/**
 * 用重命名替换产物目录，避免“先删除旧产物再改名”导致中途失败后两头皆空。
 *
 * 流程：旧目录改名为备份 → staging 改名为正式目录 → 清理备份。
 * 第二步失败时把备份改回原位，保证旧产物仍然可用。
 */
export async function replaceDirectory(staging, target) {
	const backup = `${target}.bak-${Date.now()}`;
	let hasBackup = false;

	if (await pathExists(target)) {
		await withRetry(() => rename(target, backup), '备份旧构建产物');
		hasBackup = true;
	}

	try {
		await withRetry(() => rename(staging, target), '替换构建产物');
	} catch (error) {
		if (hasBackup) {
			await withRetry(() => rename(backup, target), '回滚旧构建产物').catch(() => {});
		}
		await removePathWithRetry(staging).catch(() => {});
		throw error;
	}

	if (hasBackup) {
		await removePathWithRetry(backup).catch(() => {
			console.warn(`旧产物备份未能删除，可手动清理：${backup}`);
		});
	}
}
