import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  clearStoredAuthSession,
  getStoredAuthSession,
  loginWithWeChat,
  updateCurrentUserProfile,
  type UserProfileUpdate,
  type StoredAuthSession
} from '../utils/http/authentication'
import type { VocalRange } from '../services/account/preferences'
import {
  synchronizeAllUserDataAfterLogin,
  synchronizeAllUserDataBeforeLogout
} from '../services/account/data-synchronization'

export const useAuthenticationStore = defineStore('authentication', () => {
  const session = ref<StoredAuthSession | null>(getStoredAuthSession())
  const loggingIn = ref(false)

  async function login(locale: string, profile: UserProfileUpdate) {
    if (loggingIn.value) return session.value
    loggingIn.value = true
    try {
      session.value = await loginWithWeChat(locale, profile)
      try {
        session.value = await synchronizeAllUserDataAfterLogin(session.value)
      } catch {
        // 登录已经成功；同步失败的数据继续留在本地，后续再次重试。
      }
      return session.value
    } finally {
      loggingIn.value = false
    }
  }

  async function logout() {
    if (!session.value) return
    await synchronizeAllUserDataBeforeLogout(session.value)
    clearStoredAuthSession()
    session.value = null
  }

  function refreshFromStorage() {
    session.value = getStoredAuthSession()
  }

  async function updateVocalRangePreference(range: VocalRange) {
    session.value = await updateCurrentUserProfile({
      preferredRangeMinimumMidi: range.minimumMidi,
      preferredRangeMaximumMidi: range.maximumMidi
    })
    return session.value
  }

  async function updateProfile(profile: UserProfileUpdate) {
    session.value = await updateCurrentUserProfile(profile)
    return session.value
  }

  return {
    session,
    loggingIn,
    login,
    logout,
    refreshFromStorage,
    updateProfile,
    updateVocalRangePreference
  }
})
