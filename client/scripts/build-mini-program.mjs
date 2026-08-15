import { readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const clientDirectory = resolve(scriptDirectory, '..')
const sourceDirectory = resolve(clientDirectory, 'src')
const outputDirectory = resolve(clientDirectory, 'dist/build/mp-weixin')
const manifestPath = resolve(sourceDirectory, 'manifest.json')
const DEFAULT_APP_ID = 'touristappid'

const originalManifest = await readFile(manifestPath, 'utf8')
const buildManifest = JSON.parse(originalManifest)

buildManifest['mp-weixin'].appid =
  process.env.SINGJOURNEY_MINI_PROGRAM_APP_ID || DEFAULT_APP_ID

await rm(outputDirectory, { recursive: true, force: true })
await writeFile(manifestPath, `${JSON.stringify(buildManifest, null, 2)}\n`, 'utf8')

try {
  await runUniBuild(sourceDirectory, outputDirectory)
} finally {
  await writeFile(manifestPath, originalManifest, 'utf8')
}

function runUniBuild(inputDirectory, outputDirectory) {
  const executable = process.platform === 'win32' ? 'uni.cmd' : 'uni'
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, ['build', '-p', 'mp-weixin'], {
      cwd: clientDirectory,
      env: {
        ...process.env,
        VITE_RELEASE_COMPONENT: 'wx',
        UNI_INPUT_DIR: inputDirectory,
        UNI_OUTPUT_DIR: outputDirectory
      },
      shell: process.platform === 'win32',
      stdio: 'inherit'
    })
    child.on('error', rejectPromise)
    child.on('exit', (code) =>
      code === 0 ? resolvePromise() : rejectPromise(new Error(`uni build exited with code ${code}`))
    )
  })
}
