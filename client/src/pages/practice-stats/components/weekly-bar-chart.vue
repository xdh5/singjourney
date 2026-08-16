<template>
  <view class="chart">
    <view class="plot">
      <view
        v-for="(day, index) in days"
        :key="day.date"
        class="bar-column"
      >
        <text class="bar-value">{{ minutes(day.durationSeconds) }}</text>
        <view class="bar-track">
          <view
            class="bar"
            :style="{ height: `${barHeight(day.durationSeconds)}%` }"
          />
        </view>
        <text class="weekday">{{ weekdays[index] }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  days: Array<{ date: string; sessions: number; durationSeconds: number }>
  weekdays: string[]
}>()
const maximum = computed(() => Math.max(1, ...props.days.map((day) => day.durationSeconds)))

function minutes(seconds: number) {
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0
}
function barHeight(seconds: number) {
  return seconds > 0 ? Math.max(8, (seconds / maximum.value) * 100) : 0
}
</script>

<style scoped lang="scss">
.chart {
  height: 270rpx;
  margin-top: 22rpx;
  border-bottom: 1px solid #dfe8e4;
}
.plot {
  display: grid;
  height: 100%;
  grid-template-columns: repeat(7, 1fr);
}
.bar-column {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-direction: column;
}
.bar-value {
  height: 34rpx;
  font-size: 18rpx;
}
.bar-track {
  display: flex;
  width: 30rpx;
  height: 184rpx;
  align-items: flex-end;
}
.bar {
  width: 100%;
  min-height: 0;
  border-radius: 8rpx 8rpx 2rpx 2rpx;
  background: linear-gradient(180deg, #079d50, #65c99c);
}
.weekday {
  margin-top: 12rpx;
  color: #41544d;
  font-size: 20rpx;
}
</style>
