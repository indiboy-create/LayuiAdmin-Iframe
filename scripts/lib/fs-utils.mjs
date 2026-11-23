import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

export async function exists(target) {
	try {
		await stat(target);
		return true;
	} catch {
		return false;
	}
}

export function shownPath(rootDir, file) {
	return relative(rootDir, file).replace(/\\/g, '/');
}
