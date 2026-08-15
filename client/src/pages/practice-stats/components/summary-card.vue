<template>
  <view
    class="summary-card sj-card"
    :class="{ highlighted }"
  >
    <text class="summary-period">{{ period }}</text>
    <view class="summary-values">
      <view class="summary-value">
        <text class="summary-number">{{ sessions }}</text>
        <text class="summary-label">{{ sessionsLabel }}</text>
      </view>
      <view class="summary-divider" />
      <view class="summary-value">
        <text class="summary-number duration-number">{{ duration }}</text>
        <text class="summary-label">{{ durationLabel }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  period: string
  sessions: number
  sessionsLabel: string
  duration: string
  durationLabel: string
  highlighted?: boolean
}>()
</script>

<style scoped lang="scss">
.summary-card {
  min-width: 0;
  padding: 22rpx;
}
.summary-card.highlighted {
  border-color: #80a99b;
  background: $singjourney-surface;
}
.summary-period {
  color: #527266;
  font-size: 22rpx;
  font-weight: 800;
}
.summary-values {
  display: flex;
  align-items: stretch;
  margin-top: 17rpx;
}
.summary-value {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}
.summary-divider {
  width: 1px;
  margin: 0 13rpx;
  background: #d8e6e0;
}
.summary-number {
  color: $singjourney-text-primary;
  font-size: 38rpx;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.duration-number {
  font-size: 28rpx;
}
.summary-label {
  margin-top: 8rpx;
  color: #718980;
  font-size: 19rpx;
}
</style>
