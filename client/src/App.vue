<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { initializeTelemetry } from './utils/telemetry'

onLaunch(() => {
  initializeTelemetry()
})
</script>

<style lang="scss">
@import './styles/foundations.scss';

page {
  min-height: 100%;
  background: #fff;
  color: #294c43;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

view,
text,
image,
button,
canvas {
  animation: none !important;
  transition: none !important;
}

button::after {
  border: 0;
}
</style>
