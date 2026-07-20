<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { initializeRuntimeConfig } from './config/runtime'
import { removeLegacyWebAppCache } from './platform/legacy-pwa'

onLaunch(() => {
  void removeLegacyWebAppCache()
  void initializeRuntimeConfig()
})
</script>

<style>
page {
  min-height: 100%;
  background: #fff;
  color: #294c43;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

view, text, image, button, canvas {
  animation: none !important;
  transition: none !important;
}

button::after { border: 0; }
</style>
