import { access, rename, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const platform = process.argv[2]
const sourceDirectoryName = process.argv[3]
const supportedPlatforms = new Set(['ios', 'android', 'harmony'])

if (!supportedPlatforms.has(platform) || !sourceDirectoryName) {
  throw new Error('Usage: finalize-native-build.mjs <ios|android|harmony> <source-directory>')
}

const buildRoot = resolve(import.meta.dirname, '..', 'dist', 'build')
const sourcePath = resolve(buildRoot, sourceDirectoryName)
const targetPath = resolve(buildRoot, platform)

await access(sourcePath)
await rm(targetPath, { recursive: true, force: true })
await rename(sourcePath, targetPath)
process.stdout.write(`native artifact: ${targetPath}\n`)
