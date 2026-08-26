import { apiStorageKey, HttpError, requestJson, type HttpMethod } from './client'
import type { VoicePreset } from '../../services/account/preferences'

const AUTH_SESSION_STORAGE_KEY = apiStorageKey('auth-session')
const LOCAL_USER_SNAPSHOT_STORAGE_KEY = apiStorageKey('account.user-local-snapshot')
const SESSION_EXPIRY_SAFETY_MS = 60 * 1000

export interface AuthUser {
  id: string
  display_name: string | null
  avatar_data_url: string | null
  locale: string | null
  preferred_voice_preset: VoicePreset | null
  preferred_range_min_midi: number | null
  preferred_range_max_midi: number | null
}

export interface UserProfileUpdate {
  displayName?: string
  avatarDataUrl?: string
  preferredVoicePreset?: VoicePreset
  preferredRangeMinimumMidi?: number
  preferredRangeMaximumMidi?: number
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

export async function loginWithWeChat(locale: string, profile: UserProfileUpdate) {
  let stage = 'wx.login'
  try {
    const code = await requestWeChatLoginCode()
    stage = 'POST /auth/wechat/login'
    const response = await requestJson<LoginResponse>('/auth/wechat/login', {
      method: 'POST',
      data: {
        code,
        locale,
        display_name: profile.displayName,
        avatar_data_url: profile.avatarDataUrl
      }
    })
    const session: StoredAuthSession = {
      accessToken: response.access_token,
      expiresAt: response.expires_at,
      user: response.user
    }
    uni.setStorageSync(AUTH_SESSION_STORAGE_KEY, session)
    return session
  } catch (error) {
    console.error('[登录错误] 登录流程中断', { stage, rawError: error })
    throw error
  }
}

export function clearStoredAuthSession() {
  uni.removeStorageSync(AUTH_SESSION_STORAGE_KEY)
}

export function storeLocalUserSnapshot(user: AuthUser) {
  uni.setStorageSync(LOCAL_USER_SNAPSHOT_STORAGE_KEY, user)
}

export function readLocalUserSnapshot(): AuthUser | null {
  const stored = uni.getStorageSync(LOCAL_USER_SNAPSHOT_STORAGE_KEY) as AuthUser | undefined
  return stored?.id ? stored : null
}

export function clearLocalUserSnapshot() {
  uni.removeStorageSync(LOCAL_USER_SNAPSHOT_STORAGE_KEY)
}

export async function updateCurrentUserProfile(profile: UserProfileUpdate) {
  const user = await requestAuthenticatedJson<AuthUser>('/auth/profile', 'PATCH', {
    display_name: profile.displayName,
    avatar_data_url: profile.avatarDataUrl,
    preferred_voice_preset: profile.preferredVoicePreset,
    preferred_range_min_midi: profile.preferredRangeMinimumMidi,
    preferred_range_max_midi: profile.preferredRangeMaximumMidi
  })
  const session = getStoredAuthSession()
  if (!session) throw new Error('Authentication session required')
  const updated = { ...session, user }
  uni.setStorageSync(AUTH_SESSION_STORAGE_KEY, updated)
  return updated
}

export async function requestAuthenticatedJson<T>(
  path: string,
  method: HttpMethod = 'GET',
  data?: unknown
) {
  const session = getStoredAuthSession()
  if (!session) throw new Error('Authentication session required')
  try {
    return await requestJson<T>(path, { method, data, accessToken: session.accessToken })
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 401) clearStoredAuthSession()
    throw error
  }
}

function requestWeChatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (result) =>
        result.code ? resolve(result.code) : reject(new Error('WeChat returned no login code')),
      fail: reject
    })
  })
}
