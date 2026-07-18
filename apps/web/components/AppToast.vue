<template>
  <Teleport to="body">
    <TransitionGroup name="toast-list" tag="div" class="toast-stack" aria-live="polite">
      <button
        v-for="item in items"
        :key="item.id"
        class="toast-item"
        :class="`toast-${item.kind}`"
        type="button"
        @click="$emit('dismiss', item.id)"
      >
        <i :class="iconClass(item.kind)"></i>
        <span>{{ item.message }}</span>
      </button>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import type { ToastItem, ToastKind } from '~/composables/useToast'

defineProps<{
  items: ToastItem[]
}>()

defineEmits<{
  dismiss: [id: number]
}>()

function iconClass(kind: ToastKind) {
  if (kind === 'success') return 'bi bi-check-circle-fill'
  if (kind === 'error') return 'bi bi-exclamation-circle-fill'
  return 'bi bi-info-circle-fill'
}
</script>

<style scoped>
.toast-stack {
  position: fixed;
  right: max(14px, env(safe-area-inset-right));
  top: max(14px, env(safe-area-inset-top));
  z-index: 1000;
  display: grid;
  width: min(340px, calc(100vw - 28px));
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  padding: 10px 12px;
  border: 1px solid #d8e2ef;
  border-radius: 8px;
  color: #172033;
  background: #fff;
  box-shadow: 0 12px 26px rgba(15, 23, 42, 0.14);
  text-align: left;
  pointer-events: auto;
}

.toast-item span {
  overflow: hidden;
  color: #1d2938;
  font-size: 0.88rem;
  line-height: 1.35;
}

.toast-success i {
  color: #16a34a;
}

.toast-error i {
  color: #dc2626;
}

.toast-info i {
  color: #2563eb;
}

.toast-list-enter-active,
.toast-list-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-list-enter-from,
.toast-list-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
