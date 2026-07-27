import { resolveApiUrl } from '../config/endpoints'

const AUTH_SESSION_STORAGE_KEY = 'singjourney.practice.auth-session'
const AUTH_REQUEST_TIMEOUT_MS = 15000
const SESSION_EXPIRY_SAFETY_MS = 60 * 1000

interface AuthUser {
  id: string
  display_name: string | null
  locale: string | null
}

export interface StoredAuthSession {
  accessToken: string
  expiresAt: string
  user: AuthUser
}

interface LoginResponse {
  access_token: string
  expires_at: string
  user: AuthUser
}

export function getStoredAuthSession(): StoredAuthSession | null {
  const stored = uni.getStorageSync(AUTH_SESSION_STORAGE_KEY) as StoredAuthSession | undefined
  if (!stored?.accessToken || !stored.expiresAt) return null
  if (Date.parse(stored.expiresAt) <= Date.now() + SESSION_EXPIRY_SAFETY_MS) {
    clearStoredAuthSession()
    return null
  }
  return stored
}

export async function loginToPracticeMiniProgram(locale: string) {
  const code = await requestWeChatLoginCode()
  const response = await requestJson<LoginResponse>(
    resolveApiUrl('/auth/wechat/practice/login'),
    'POST',
    { code, locale }
  )
  const session: StoredAuthSession = {
    accessToken: response.access_token,
    expiresAt: response.expires_at,
    user: response.user
  }
  uni.setStorageSync(AUTH_SESSION_STORAGE_KEY, session)
  return session
}

export function clearStoredAuthSession() {
  uni.removeStorageSync(AUTH_SESSION_STORAGE_KEY)
}

export function requestAuthenticatedJson<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  data?: unknown
) {
  const session = getStoredAuthSession()
  if (!session) return Promise.reject(new Error('Authentication session required'))
  return requestJson<T>(resolveApiUrl(path), method, data, session.accessToken)
}

function requestWeChatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: result => result.code ? resolve(result.code) : reject(new Error('WeChat returned no login code')),
      fail: reject
    })
  })
}

function requestJson<T>(url: string, method: 'GET' | 'POST', data?: unknown, accessToken?: string) {
  return new Promise<T>((resolve, reject) => {
    uni.request({
      url,
      method,
      data: data as any,
      timeout: AUTH_REQUEST_TIMEOUT_MS,
      header: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      },
      success: response => {
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(response.data as T)
        else reject(new Error(`Authentication failed: ${response.statusCode}`))
      },
      fail: reject
    })
  })
}
