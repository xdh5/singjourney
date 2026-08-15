import { i18n } from '../../i18n'

const DEFAULT_API_BASE_URL = 'https://singjourney.com/api/v1'
const DEFAULT_REQUEST_TIMEOUT_MS = 15000

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface HttpRequestOptions {
  method?: HttpMethod
  data?: unknown
  headers?: Record<string, string>
  timeoutMs?: number
  accessToken?: string
}

export class HttpError extends Error {
  readonly statusCode: number
  readonly responseData: unknown

  constructor(statusCode: number, responseData: unknown) {
    super(`HTTP request failed: ${statusCode}`)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.responseData = responseData
  }
}

export function requestJson<T>(path: string, options: HttpRequestOptions = {}) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: resolveApiUrl(path),
      method: options.method ?? 'GET',
      data: options.data as any,
      timeout: options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      header: {
        'Content-Type': 'application/json',
        'Accept-Language': i18n.global.locale.value,
        ...options.headers,
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {})
      },
      success: (response) => {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as T)
          return
        }
        reject(new HttpError(response.statusCode, response.data))
      },
      fail: reject
    })
  })
}

export function resolveApiUrl(path: string) {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  const baseUrl = configuredBaseUrl || DEFAULT_API_BASE_URL
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
