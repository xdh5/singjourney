import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  addPracticeFavorite,
  readLocalPracticeFavoriteIds,
  removePracticeFavorite,
  synchronizePracticeFavoritesToServer,
  writeLocalPracticeFavoriteIds
} from '../services/practice/favorites'
import { getStoredAuthSession } from '../utils/http/authentication'

export const usePracticeFavoritesStore = defineStore('practice-favorites', () => {
  const favoriteIds = ref<string[]>(readLocalPracticeFavoriteIds())
  const loading = ref(false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      if (!getStoredAuthSession()) {
        favoriteIds.value = readLocalPracticeFavoriteIds()
        return
      }
      favoriteIds.value = await synchronizePracticeFavoritesToServer()
    } catch {
      favoriteIds.value = readLocalPracticeFavoriteIds()
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
      writeLocalPracticeFavoriteIds(favoriteIds.value)
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
