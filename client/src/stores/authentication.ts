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

export const useAuthenticationStore = defineStore('authentication', () => {
  const session = ref<StoredAuthSession | null>(getStoredAuthSession())
  const loggingIn = ref(false)

  async function login(locale: string) {
    if (loggingIn.value) return session.value
    loggingIn.value = true
    try {
      session.value = await loginWithWeChat(locale)
      return session.value
    } finally {
      loggingIn.value = false
    }
  }

  function logout() {
    clearStoredAuthSession()
    session.value = null
  }

  function refreshFromStorage() {
    session.value = getStoredAuthSession()
  }

  async function updateProfile(profile: UserProfileUpdate) {
    session.value = await updateCurrentUserProfile(profile)
    return session.value
  }

  return { session, loggingIn, login, logout, refreshFromStorage, updateProfile }
})
