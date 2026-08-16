import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchPracticeCatalog,
  type PracticeCategory,
  type PracticeExercise
} from '../services/practice/catalog'

export const usePracticeCatalogStore = defineStore('practice-catalog', () => {
  const categories = ref<PracticeCategory[]>([])
  const exercises = ref<PracticeExercise[]>([])
  const loading = ref(false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      const catalog = await fetchPracticeCatalog()
      // 刷新成功后再整体替换，接口慢或临时失败时保留当前曲目，避免列表闪空或消失。
      categories.value = catalog.categories
      exercises.value = catalog.exercises
    } finally {
      loading.value = false
    }
  }

  return { categories, exercises, loading, refresh }
})
