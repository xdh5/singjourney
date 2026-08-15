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
    categories.value = []
    exercises.value = []
    try {
      const catalog = await fetchPracticeCatalog()
      categories.value = catalog.categories
      exercises.value = catalog.exercises
    } finally {
      loading.value = false
    }
  }

  return { categories, exercises, loading, refresh }
})
