import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  EMPTY_PRACTICE_STATISTICS,
  fetchPracticeStatistics,
  flushPendingPracticeEvents,
  type PracticeStatisticsView
} from '../services/practice/statistics'

export const usePracticeStatisticsStore = defineStore('practice-statistics', () => {
  const statistics = ref<PracticeStatisticsView>({ ...EMPTY_PRACTICE_STATISTICS })
  const loading = ref(false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      await flushPendingPracticeEvents()
      statistics.value = await fetchPracticeStatistics()
    } finally {
      loading.value = false
    }
  }

  function reset() {
    statistics.value = { ...EMPTY_PRACTICE_STATISTICS }
    loading.value = false
  }

  return { statistics, loading, refresh, reset }
})
