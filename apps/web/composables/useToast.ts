import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  kind: ToastKind
  message: string
}

const toastItems = ref<ToastItem[]>([])
let nextToastId = 1

export function useToast() {
  function removeToast(id: number) {
    toastItems.value = toastItems.value.filter((item) => item.id !== id)
  }

  function showToast(message: string, kind: ToastKind = 'info') {
    const id = nextToastId++
    toastItems.value = [...toastItems.value, { id, kind, message }]

    if (import.meta.client) {
      window.setTimeout(() => removeToast(id), 2800)
    }
  }

  return {
    toastItems,
    showToast,
    removeToast
  }
}
