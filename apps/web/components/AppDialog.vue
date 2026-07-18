<template>
  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="open" class="dialog-backdrop" role="presentation" @click.self="$emit('cancel')">
        <section
          class="dialog-panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
        >
          <header class="dialog-header">
            <h2 :id="titleId">{{ title }}</h2>
            <button class="icon-button" type="button" aria-label="关闭" :disabled="busy" @click="$emit('cancel')">
              <i class="bi bi-x-lg"></i>
            </button>
          </header>

          <p v-if="message" class="dialog-message">{{ message }}</p>
          <slot />

          <footer class="dialog-actions">
            <button class="ghost-button" type="button" :disabled="busy" @click="$emit('cancel')">
              {{ cancelText }}
            </button>
            <button
              class="confirm-button"
              :class="{ danger }"
              type="button"
              :disabled="busy"
              @click="$emit('confirm')"
            >
              <i v-if="busy" class="bi bi-hourglass-split"></i>
              <span>{{ confirmText }}</span>
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  open: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  busy?: boolean
}>(), {
  message: '',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
  busy: false
})

defineEmits<{
  confirm: []
  cancel: []
}>()

const titleId = `dialog-title-${Math.random().toString(36).slice(2)}`
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(15, 23, 42, 0.42);
}

.dialog-panel {
  width: min(360px, 100%);
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
  overflow: hidden;
}

.dialog-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 34px;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 8px;
}

.dialog-header h2 {
  margin: 0;
  color: #172033;
  font-size: 1rem;
  font-weight: 850;
}

.icon-button,
.ghost-button,
.confirm-button {
  border: 1px solid #d6dfeb;
  border-radius: 999px;
  background: #fff;
  color: #344255;
}

.icon-button {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
}

.dialog-message {
  margin: 0;
  padding: 0 16px 12px;
  color: #5f6f82;
  font-size: 0.88rem;
  line-height: 1.5;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px 16px;
}

.ghost-button,
.confirm-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  height: 36px;
  gap: 6px;
  padding: 0 14px;
  font-size: 0.88rem;
  font-weight: 800;
}

.confirm-button {
  border-color: #ffc43d;
  background: #ffc43d;
  color: #172033;
}

.confirm-button.danger {
  border-color: #ef4444;
  background: #ef4444;
  color: #fff;
}

button:disabled {
  opacity: 0.55;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
