const PUBLIC_ORIGIN = 'https://singjourney.com'
const API_BASE_URL = `${PUBLIC_ORIGIN}/api/v1`

export function resolveApiUrl(path: string) {
  return joinUrl(API_BASE_URL, path)
}

export function resolveShareUrl(path: string) {
  return joinUrl(PUBLIC_ORIGIN, path)
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
