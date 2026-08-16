import { fileURLToPath } from 'node:url'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { build } from 'vite'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const clientDirectory = resolve(scriptDirectory, '..')
const outputDirectory = resolve(clientDirectory, 'src/static/workers')
const wasmOutputDirectory = resolve(clientDirectory, 'src/static/wasm')
const dependencyLicense = resolve(clientDirectory, '../node_modules/wasm-media-encoders/LICENSE')
const bundledLicense = resolve(outputDirectory, 'wasm-media-encoders-LICENSE.txt')

async function buildWorker(entryName, outputName, globalName) {
  await build({
    configFile: false,
    logLevel: 'warn',
    build: {
      emptyOutDir: false,
      minify: true,
      outDir: outputDirectory,
      lib: {
        entry: resolve(clientDirectory, `src/workers/${entryName}`),
        formats: ['iife'],
        name: globalName,
        fileName: () => outputName
      }
    }
  })
}

await mkdir(outputDirectory, { recursive: true })
await mkdir(wasmOutputDirectory, { recursive: true })
await buildWorker('pitch-worker.mjs', 'pitch.js', 'SingJourneyPitchWorker')
await buildWorker('audio-export-worker.mjs', 'audio-export.js', 'SingJourneyAudioExportWorker')
await extractMp3EncoderWasm()
await copyFile(dependencyLicense, bundledLicense)

async function extractMp3EncoderWasm() {
  const workerPath = resolve(outputDirectory, 'audio-export.js')
  const workerSource = await readFile(workerPath, 'utf8')
  const match = workerSource.match(/data:application\/wasm;base64,([A-Za-z0-9+/=]+)/)
  if (!match) throw new Error('未能从 MP3 编码器中提取 WASM 资源')
  // WXWebAssembly 只接受代码包内的 .wasm 路径，不接受浏览器使用的 ArrayBuffer。
  await writeFile(resolve(wasmOutputDirectory, 'mp3-encoder.wasm'), Buffer.from(match[1], 'base64'))
  // WASM 已独立存放，Worker 内嵌数据仅保留一个占位符供依赖走完加载分支，
  // 真正的二进制由 WXWebAssembly 按文件路径读取，避免代码包重复携带约 130 KiB。
  await writeFile(
    workerPath,
    workerSource.replace(match[0], 'data:application/wasm;base64,AA==')
  )
}
