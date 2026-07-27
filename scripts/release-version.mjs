import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const versionsPath = resolve(repositoryRoot, 'release', 'versions.json')
const supportedComponents = new Set(['web', 'wx-pitch', 'wx-practice', 'ios', 'android', 'harmony', 'server'])
const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/
const releaseTagPattern = /^(web|wx-pitch|wx-practice|ios|android|harmony|server)-v(.+)$/

async function loadVersions() {
  const versions = JSON.parse(await readFile(versionsPath, 'utf8'))
  for (const component of supportedComponents) {
    const version = versions.components?.[component]
    if (!semanticVersionPattern.test(version ?? '')) {
      throw new Error(`release/versions.json 中 ${component} 的版本号无效: ${version ?? '<missing>'}`)
    }
  }
  return versions
}

function versionCode(version) {
  const match = semanticVersionPattern.exec(version)
  if (!match) throw new Error(`无法生成 versionCode: ${version}`)
  const [, major, minor, patch] = match
  return Number(major) * 1_000_000 + Number(minor) * 1_000 + Number(patch)
}

async function resolveRelease(component, tag) {
  const versions = await loadVersions()
  if (!supportedComponents.has(component)) throw new Error(`不支持的发布端: ${component}`)

  const configuredVersion = versions.components[component]
  if (tag) {
    const match = releaseTagPattern.exec(tag)
    if (!match) throw new Error(`Tag 格式无效: ${tag}`)
    const [, tagComponent, tagVersion] = match
    if (tagComponent !== component) {
      throw new Error(`Tag ${tag} 不能用于 ${component} 构建`)
    }
    if (tagVersion !== configuredVersion) {
      throw new Error(`Tag 版本 ${tagVersion} 与 release/versions.json 中的 ${configuredVersion} 不一致`)
    }
  }
  return { component, version: configuredVersion, versionCode: versionCode(configuredVersion) }
}

async function prepareClientManifest(release) {
  if (!['ios', 'android', 'harmony'].includes(release.component)) {
    throw new Error('只有 iOS、Android 和 HarmonyOS 构建需要写入原生应用版本')
  }
  const manifestPath = resolve(repositoryRoot, 'client', 'src', 'manifest.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.versionName = release.version
  manifest.versionCode = String(release.versionCode)
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

const [command = 'check', component, tag = ''] = process.argv.slice(2)

try {
  if (command === 'check') {
    await loadVersions()
    process.stdout.write('release versions are valid\n')
  } else if (command === 'resolve') {
    const release = await resolveRelease(component, tag)
    process.stdout.write(`${JSON.stringify(release)}\n`)
  } else if (command === 'github-output') {
    const release = await resolveRelease(component, tag)
    process.stdout.write(`component=${release.component}\nversion=${release.version}\nversion_code=${release.versionCode}\n`)
  } else if (command === 'prepare-client') {
    const release = await resolveRelease(component, tag)
    await prepareClientManifest(release)
    process.stdout.write(`prepared ${release.component} ${release.version} (${release.versionCode})\n`)
  } else {
    throw new Error(`未知命令: ${command}`)
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
