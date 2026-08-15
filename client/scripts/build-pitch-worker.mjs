import { fileURLToPath } from 'node:url'
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { build } from 'vite'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const clientDirectory = resolve(scriptDirectory, '..')
const entryFile = resolve(clientDirectory, 'src/workers/pitch-worker.mjs')
const outputDirectory = resolve(clientDirectory, 'src/static/workers')
const dependencyLicense = resolve(clientDirectory, '../node_modules/@breezystack/lamejs/LICENSE')
const bundledLicense = resolve(outputDirectory, 'lamejs-LICENSE.txt')

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    emptyOutDir: false,
    minify: true,
    outDir: outputDirectory,
    lib: {
      entry: entryFile,
      formats: ['iife'],
      name: 'SingJourneyPitchWorker',
      fileName: () => 'pitch.js'
    }
  }
})

await mkdir(outputDirectory, { recursive: true })
await copyFile(dependencyLicense, bundledLicense)
