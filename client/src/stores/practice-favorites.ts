import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  addPracticeFavorite,
  fetchPracticeFavorites,
  removePracticeFavorite
} from '../services/practice/favorites'
import { getStoredAuthSession } from '../utils/http/authentication'

const LOCAL_FAVORITE_IDS_KEY = 'singjourney.practice.favorite-ids'

export const usePracticeFavoritesStore = defineStore('practice-favorites', () => {
  const favoriteIds = ref<string[]>(readLocalFavoriteIds())
  const loading = ref(false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      if (!getStoredAuthSession()) {
        favoriteIds.value = readLocalFavoriteIds()
        return
      }
      const remoteIds = await fetchPracticeFavorites()
      const localIds = readLocalFavoriteIds()
      const missingRemoteIds = localIds.filter((id) => !remoteIds.includes(id))
      for (const id of missingRemoteIds) await addPracticeFavorite(id)
      favoriteIds.value = [...new Set([...remoteIds, ...missingRemoteIds])]
      clearLocalFavoriteIds()
    } catch {
      favoriteIds.value = []
    } finally {
      loading.value = false
    }
  }

  async function toggle(exerciseId: string) {
    const previous = favoriteIds.value
    const removing = previous.includes(exerciseId)
    favoriteIds.value = removing
      ? previous.filter((id) => id !== exerciseId)
      : [...previous, exerciseId]

    if (!getStoredAuthSession()) {
      writeLocalFavoriteIds(favoriteIds.value)
      return
    }
    try {
      if (removing) await removePracticeFavorite(exerciseId)
      else await addPracticeFavorite(exerciseId)
    } catch {
      favoriteIds.value = previous
    }
  }

  return { favoriteIds, loading, refresh, toggle }
})

function readLocalFavoriteIds() {
  const value = uni.getStorageSync(LOCAL_FAVORITE_IDS_KEY)
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
}

function writeLocalFavoriteIds(ids: string[]) {
  if (ids.length === 0) clearLocalFavoriteIds()
  else uni.setStorageSync(LOCAL_FAVORITE_IDS_KEY, ids)
}

function clearLocalFavoriteIds() {
  uni.removeStorageSync(LOCAL_FAVORITE_IDS_KEY)
}
