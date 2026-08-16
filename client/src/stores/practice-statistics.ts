import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createEmptyPracticeStatistics,
  fetchPracticeStatistics,
  type PracticeStatisticsView
} from '../services/practice/statistics'

export const usePracticeStatisticsStore = defineStore('practice-statistics', () => {
  const statistics = ref<PracticeStatisticsView>(createEmptyPracticeStatistics())
  const loading = ref(false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      statistics.value = await fetchPracticeStatistics()
    } finally {
      loading.value = false
    }
  }

  function reset() {
    statistics.value = createEmptyPracticeStatistics()
    loading.value = false
  }

  return { statistics, loading, refresh, reset }
})
