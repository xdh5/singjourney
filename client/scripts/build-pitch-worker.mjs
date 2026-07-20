import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { build } from 'vite'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const clientDirectory = resolve(scriptDirectory, '..')
const entryFile = resolve(clientDirectory, 'src/workers/pitch-worker.mjs')
const outputDirectory = resolve(clientDirectory, 'src/static/workers')

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
      name: 'VoiceTracePitchWorker',
      fileName: () => 'pitch.js'
    }
  }
})
