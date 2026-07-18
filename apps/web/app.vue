<template>
  <main class="app-shell">
    <NuxtPage />
  </main>
  <AppToast :items="toastItems || []" @dismiss="removeToast" />
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast'

const { toastItems, removeToast } = useToast()
</script>

<style>
* {
  box-sizing: border-box;
}

html,
body,
#__nuxt {
  min-height: 100%;
  margin: 0;
  padding: 0;
}

body {
  background: #f5f7fa;
  touch-action: manipulation;
  -webkit-text-size-adjust: 100%;
}

.app-shell {
  min-height: 100vh;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
