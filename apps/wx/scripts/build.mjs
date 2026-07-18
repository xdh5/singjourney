import { build } from 'esbuild'
import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'src')
const output = path.join(root, 'dist')
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })

const entries = ['app.ts', 'pages/index/index.ts', 'pages/record/record.ts', 'pages/recordings/recordings.ts']
for (const entry of entries) {
  await build({
    entryPoints: [path.join(source, entry)],
    outfile: path.join(output, entry.replace(/\.ts$/, '.js')),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: false,
    sourcemap: false
  })
}

async function copyAssets(directory) {
  for (const name of await readdir(directory)) {
    const from = path.join(directory, name)
    const relative = path.relative(source, from)
    const info = await stat(from)
    if (info.isDirectory()) await copyAssets(from)
    else if (!name.endsWith('.ts') && !name.endsWith('.d.ts')) {
      const to = path.join(output, relative)
      await mkdir(path.dirname(to), { recursive: true })
      await cp(from, to)
    }
  }
}
await copyAssets(source)
