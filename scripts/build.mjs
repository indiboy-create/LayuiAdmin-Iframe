import { rm, cp, readdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative, extname, join } from 'node:path'
import { minify as terserMinify } from 'terser'
import CleanCSS from 'clean-css'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'src')
const dist = resolve(root, 'dist')

// 第三方目录：原样拷贝，不压缩
const SKIP_PREFIXES = ['component/layui/']

const cleanCss = new CleanCSS({ level: 2 })

// 递归收集目录下所有文件
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
    } else {
      files.push(fullPath)
    }
  }
  return files
}

// 压缩 JS/CSS，跳过第三方目录
async function minify() {
  const files = await walk(dist)
  for (const file of files) {
    const rel = relative(dist, file).replace(/\\/g, '/')
    if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue

    const ext = extname(file).toLowerCase()
    if (ext !== '.js' && ext !== '.css') continue

    const content = await readFile(file, 'utf8')
    if (ext === '.js') {
      const result = await terserMinify(content, { compress: true, mangle: true })
      if (result.code) await writeFile(file, result.code)
    } else {
      const result = cleanCss.minify(content)
      if (!result.errors.length) await writeFile(file, result.styles)
    }
  }
}

// 清空旧产物 -> 整体拷贝 -> 压缩
await rm(dist, { recursive: true, force: true })
await cp(src, dist, { recursive: true })
await minify()

console.log(`构建完成：${dist}`)