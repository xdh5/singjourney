import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const clientDirectory = resolve(scriptDirectory, '..')
const sourceDirectory = resolve(clientDirectory, 'src')
const generatedRoot = resolve(clientDirectory, '.generated-mini-programs')
const outputRoot = resolve(clientDirectory, 'dist/build/mp-weixin')
const DEFAULT_APP_ID = 'touristappid'
const GLOBAL_STYLE = {
  navigationBarTextStyle: 'white',
  navigationBarTitleText: '%app.name%',
  navigationBarBackgroundColor: '#356b5b',
  backgroundColor: '#ffffff'
}

const requestedFolder = process.argv[2]
if (!requestedFolder) throw new Error('Mini program configuration folder is required')

const configPath = resolve(clientDirectory, 'mini-programs', requestedFolder, 'config.json')
const config = JSON.parse(await readFile(configPath, 'utf8'))
const generatedInput = resolve(generatedRoot, config.variant)
const outputDirectory = resolve(outputRoot, config.outputFolder)

await rm(generatedInput, { recursive: true, force: true })
await rm(outputDirectory, { recursive: true, force: true })
await mkdir(generatedInput, { recursive: true })
await cp(sourceDirectory, generatedInput, { recursive: true })

const sourceManifest = JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8'))
sourceManifest.name = config.name
sourceManifest.description = config.name
sourceManifest.appid = `__UNI__SINGJOURNEY_${config.variant.replace(/-/g, '_').toUpperCase()}`
sourceManifest['mp-weixin'].appid = process.env[config.appIdEnvironment] || DEFAULT_APP_ID

await writeFile(
  resolve(generatedInput, 'pages.json'),
  `${JSON.stringify({ pages: config.pages, globalStyle: GLOBAL_STYLE }, null, 2)}\n`,
  'utf8'
)
await writeFile(resolve(generatedInput, 'manifest.json'), `${JSON.stringify(sourceManifest, null, 2)}\n`, 'utf8')
await runUniBuild(generatedInput, outputDirectory, config.variant)

function runUniBuild(inputDirectory, outputDirectory, variant) {
  const executable = process.platform === 'win32' ? 'uni.cmd' : 'uni'
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(executable, ['build', '-p', 'mp-weixin'], {
      cwd: clientDirectory,
      env: {
        ...process.env,
        UNI_INPUT_DIR: inputDirectory,
        UNI_OUTPUT_DIR: outputDirectory,
        VITE_MINI_PROGRAM_VARIANT: variant
      },
      shell: process.platform === 'win32',
      stdio: 'inherit'
    })
    child.on('error', rejectPromise)
    child.on('exit', code => code === 0
      ? resolvePromise()
      : rejectPromise(new Error(`uni build exited with code ${code}`)))
  })
}
