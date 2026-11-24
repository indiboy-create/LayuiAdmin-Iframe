import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// 统一改写产物中的调试开关：可调试构建开启，正式构建关闭
export async function setDebugConfig(distDir, value) {
	const configPath = join(distDir, 'api', 'mytsa.config.json');
	const content = await readFile(configPath, 'utf8');
	const config = JSON.parse(content);
	config.debug = value;
	await writeFile(configPath, `${JSON.stringify(config, null, '\t')}\n`);
}
