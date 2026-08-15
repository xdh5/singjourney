import { access, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const platform = process.argv[2]
const sourceDirectoryName = process.argv[3]
const supportedPlatforms = new Set(['ios', 'android', 'harmony'])

if (!supportedPlatforms.has(platform) || !sourceDirectoryName) {
  throw new Error('Usage: build-native.mjs <ios|android|harmony> <source-directory>')
}

const clientRoot = resolve(import.meta.dirname, '..')
const manifestPath = resolve(clientRoot, 'src', 'manifest.json')
const originalManifest = await readFile(manifestPath, 'utf8')
const manifest = JSON.parse(originalManifest)
const appReleasePackage = JSON.parse(
  await readFile(resolve(clientRoot, 'targets', 'app', 'package.json'), 'utf8')
)

manifest.versionName = appReleasePackage.version
manifest.versionCode = String(versionCode(appReleasePackage.version))

try {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await runUniBuild(platform === 'harmony' ? 'app-harmony' : 'app-plus')
} finally {
  await writeFile(manifestPath, originalManifest)
}

const buildRoot = resolve(clientRoot, 'dist', 'build')
const sourcePath = resolve(buildRoot, sourceDirectoryName)
const targetPath = resolve(buildRoot, platform)
await access(sourcePath)
await rm(targetPath, { recursive: true, force: true })
await rename(sourcePath, targetPath)
process.stdout.write(`native artifact: ${targetPath}\n`)

function versionCode(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) throw new Error(`Invalid client version: ${version}`)
  return Number(match[1]) * 1_000_000 + Number(match[2]) * 1_000 + Number(match[3])
}

function runUniBuild(target) {
  const executable = process.platform === 'win32' ? 'uni.cmd' : 'uni'
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, ['build', '-p', target], {
      cwd: clientRoot,
      env: { ...process.env, VITE_RELEASE_COMPONENT: 'app' },
      shell: process.platform === 'win32',
      stdio: 'inherit'
    })
    child.on('error', rejectPromise)
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : rejectPromise(new Error(`uni build exited with code ${code}`))
    )
  })
}
