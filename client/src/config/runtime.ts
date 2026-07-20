export type RuntimeConfig = {
  version: number
  region: string
  api_base_url: string
  share_base_url: string
  media_base_url: string
  cache_ttl_seconds: number
}

type CachedRuntimeConfig = {
  cachedAt: number
  value: RuntimeConfig
}

const BOOTSTRAP_CONFIG_URL = 'https://tone.cyberlab.bond/api/v1/client-config'
const RUNTIME_CONFIG_STORAGE_KEY = 'shengji-runtime-config-v1'
const CONFIG_REQUEST_TIMEOUT_MS = 5000
const DEFAULT_CONFIG_CACHE_TTL_SECONDS = 3600
const MAX_CONFIG_CACHE_TTL_SECONDS = 24 * 60 * 60
const MILLISECONDS_PER_SECOND = 1000

const BUNDLED_CONFIG: RuntimeConfig = {
  version: 1,
  region: 'cn',
  api_base_url: 'https://tone.cyberlab.bond/api/v1',
  share_base_url: 'https://tone.cyberlab.bond',
  media_base_url: 'https://tone.cyberlab.bond/api/v1',
  cache_ttl_seconds: DEFAULT_CONFIG_CACHE_TTL_SECONDS
}

let currentConfig: RuntimeConfig = { ...BUNDLED_CONFIG }
let initialization: Promise<RuntimeConfig> | undefined

/**
 * Loads cached endpoints immediately and refreshes them from the stable bootstrap URL.
 * Failure never blocks application launch; the latest cached or bundled values remain active.
 */
export function initializeRuntimeConfig(): Promise<RuntimeConfig> {
  if (initialization) return initialization
  initialization = refreshRuntimeConfig().finally(() => { initialization = undefined })
  return initialization
}

export function getRuntimeConfig(): Readonly<RuntimeConfig> {
  return currentConfig
}

export function resolveApiUrl(path: string) {
  return joinUrl(currentConfig.api_base_url, path)
}

export function resolveShareUrl(path: string) {
  return joinUrl(currentConfig.share_base_url, path)
}

export function resolveMediaUrl(path: string) {
  return joinUrl(currentConfig.media_base_url, path)
}

async function refreshRuntimeConfig() {
  const cached = readCachedConfig()
  if (cached) {
    currentConfig = cached.value
    if (cached.isFresh) return currentConfig
  }

  try {
    const remote = await requestRuntimeConfig()
    if (remote.version >= currentConfig.version) {
      currentConfig = remote
      uni.setStorageSync(RUNTIME_CONFIG_STORAGE_KEY, {
        cachedAt: Date.now(),
        value: remote
      } satisfies CachedRuntimeConfig)
    }
  } catch {
    // The stable fallback is intentional: a configuration outage must not block recording.
  }
  return currentConfig
}

function readCachedConfig() {
  const candidate = uni.getStorageSync(RUNTIME_CONFIG_STORAGE_KEY) as unknown
  if (!isCachedRuntimeConfig(candidate)) return undefined
  const ttlMilliseconds = Math.min(
    candidate.value.cache_ttl_seconds,
    MAX_CONFIG_CACHE_TTL_SECONDS
  ) * MILLISECONDS_PER_SECOND
  return {
    ...candidate,
    isFresh: Date.now() - candidate.cachedAt <= ttlMilliseconds
  }
}

function requestRuntimeConfig() {
  return new Promise<RuntimeConfig>((resolve, reject) => {
    uni.request({
      url: BOOTSTRAP_CONFIG_URL,
      method: 'GET',
      timeout: CONFIG_REQUEST_TIMEOUT_MS,
      success: result => {
        if (result.statusCode === 200 && isRuntimeConfig(result.data)) resolve(result.data)
        else reject(new Error('Invalid runtime configuration response'))
      },
      fail: reject
    })
  })
}

function isCachedRuntimeConfig(value: unknown): value is CachedRuntimeConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CachedRuntimeConfig>
  return typeof candidate.cachedAt === 'number' && isRuntimeConfig(candidate.value)
}

function isRuntimeConfig(value: unknown): value is RuntimeConfig {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<RuntimeConfig>
  return Number.isInteger(candidate.version)
    && typeof candidate.region === 'string'
    && isSecureUrl(candidate.api_base_url)
    && isSecureUrl(candidate.share_base_url)
    && isSecureUrl(candidate.media_base_url)
    && typeof candidate.cache_ttl_seconds === 'number'
    && candidate.cache_ttl_seconds > 0
}

function isSecureUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('https://')
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
