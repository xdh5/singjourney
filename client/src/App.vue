<script setup lang="ts">
import { onLaunch, onShow } from '@dcloudio/uni-app'
import { isVocalPracticeMiniProgram } from './config/mini-program'
import { removeLegacyWebAppCache } from './platform/legacy-pwa'
import { getStoredAuthSession } from './shared/authentication'

const LOGIN_ROUTE = 'login'

onLaunch(() => {
  void removeLegacyWebAppCache()
})

onShow(() => {
  if (!isVocalPracticeMiniProgram || getStoredAuthSession()) return
  setTimeout(() => {
    const pages = getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route || ''
    if (currentRoute !== LOGIN_ROUTE) uni.reLaunch({ url: `/${LOGIN_ROUTE}` })
  }, 0)
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
