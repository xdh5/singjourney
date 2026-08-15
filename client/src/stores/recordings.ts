import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  listRecordings,
  removeRecording,
  renameRecording,
  type Recording
} from '../utils/recording/storage'

export const useRecordingsStore = defineStore('recordings', () => {
  const items = ref<Recording[]>([])
  const loading = ref(false)

  async function refresh() {
    if (loading.value) return
    loading.value = true
    try {
      items.value = await listRecordings()
    } finally {
      loading.value = false
    }
  }

  async function remove(ids: string[]) {
    await removeRecording(ids)
    await refresh()
  }

  async function rename(id: string, name: string) {
    await renameRecording(id, name)
    await refresh()
  }

  return { items, loading, refresh, remove, rename }
})
