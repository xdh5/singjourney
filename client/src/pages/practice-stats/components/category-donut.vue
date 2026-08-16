<template>
  <view
    class="layout"
    :class="{ large }"
  >
    <canvas
      :id="canvasId"
      :canvas-id="canvasId"
      class="donut"
      :width="canvasSize"
      :height="canvasSize"
    />
    <view class="legend">
      <view
        v-for="(category, index) in categories"
        :key="category.key"
        class="legend-row"
      >
        <view
          class="dot"
          :style="{ background: colors[index % colors.length] }"
        />
        <text class="name">{{ category.name }}</text>
        <text class="percentage">{{ Math.round(category.percentage) }}%</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, watch } from 'vue'
import type { CategoryView } from '../../../services/practice/statistics'

const props = withDefaults(defineProps<{ categories: CategoryView[]; large?: boolean }>(), {
  large: false
})
const colors = ['#079b4f', '#20ac68', '#4ebc88', '#55aaa1', '#83b9ac', '#c2d2ce']
const canvasSize = props.large ? 190 : 150
const canvasId = `practice-donut-${Math.random().toString(36).slice(2, 9)}`
const instance = getCurrentInstance()

onMounted(() => void nextTick(draw))
watch(() => props.categories, () => void nextTick(draw), { deep: true })

function draw() {
  const context = uni.createCanvasContext(canvasId, instance?.proxy)
  const size = canvasSize
  const center = size / 2
  const radius = size * 0.4
  const width = size * 0.2
  const total = props.categories.reduce((sum, category) => sum + category.durationSeconds, 0)
  context.clearRect(0, 0, size, size)
  if (!total) {
    context.beginPath()
    context.setStrokeStyle('#e7eeeb')
    context.setLineWidth(width)
    context.arc(center, center, radius, 0, Math.PI * 2)
    context.stroke()
    context.draw()
    return
  }
  let start = -Math.PI / 2
  props.categories.forEach((category, index) => {
    const end = start + (category.durationSeconds / total) * Math.PI * 2
    context.beginPath()
    context.setStrokeStyle(colors[index % colors.length])
    context.setLineWidth(width)
    context.arc(center, center, radius, start + 0.012, end - 0.012)
    context.stroke()
    start = end
  })
  context.draw()
}
</script>

<style scoped lang="scss">
.layout {
  display: flex;
  min-height: 184rpx;
  align-items: center;
  margin-top: 16rpx;
  gap: 10rpx;
}
.layout.large {
  justify-content: center;
  gap: 42rpx;
}
.donut {
  flex: none;
  width: 150rpx;
  height: 150rpx;
}
.large .donut {
  width: 190rpx;
  height: 190rpx;
}
.legend {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.legend-row {
  display: grid;
  align-items: center;
  grid-template-columns: 12rpx minmax(0, 1fr) auto;
  gap: 8rpx;
  font-size: 18rpx;
}
.dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.percentage {
  font-weight: 700;
}
</style>
