<template>
  <view class="card" :class="{ primary }" role="button" @tap="$emit('open')">
    <view class="card-icon" :class="{ secondary: !primary }">
      <view v-if="icon === 'record'" class="record-dot" />
      <view v-else-if="icon === 'play'" class="play-triangle" />
      <text v-else-if="icon === 'music'" class="music-note">♪</text>
      <view v-else class="practice-bars"><view /><view /><view /></view>
    </view>
    <view class="copy">
      <text class="title">{{ title }}</text>
      <text class="description">{{ description }}</text>
    </view>
    <text class="chevron">›</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  description: string
  icon: 'record' | 'play' | 'music' | 'stats'
  primary?: boolean
}>()
defineEmits<{ open: [] }>()
</script>

<style scoped>
.card { display: flex; min-height: 144rpx; align-items: center; gap: 24rpx; padding: 20rpx 26rpx; box-sizing: border-box; border: 1px solid #c9ddd5; border-radius: 24rpx; color: #294c43; background: #f7faf8; }
.card.primary { border-color: #5b8e7d; background: #edf5f1; }
.card-icon { display: flex; flex: 0 0 82rpx; width: 82rpx; height: 82rpx; align-items: center; justify-content: center; border-radius: 50%; background: #356b5b; }
.card-icon.secondary { background: #6f9487; }
.record-dot { width: 14rpx; height: 14rpx; border-radius: 50%; background: #fff; }
.play-triangle { width: 0; height: 0; margin-left: 6rpx; border-top: 14rpx solid transparent; border-bottom: 14rpx solid transparent; border-left: 22rpx solid #fff; }
.music-note { color: #fff; font-size: 46rpx; font-weight: 700; }
.practice-bars { display: flex; height: 38rpx; align-items: flex-end; gap: 7rpx; }
.practice-bars view { width: 8rpx; border-radius: 8rpx; background: #fff; }
.practice-bars view:nth-child(1) { height: 20rpx; }
.practice-bars view:nth-child(2) { height: 38rpx; }
.practice-bars view:nth-child(3) { height: 28rpx; }
.copy { display: flex; flex: 1; min-width: 0; flex-direction: column; }
.title { font-size: 31rpx; font-weight: 800; }
.description { margin-top: 8rpx; color: #6b8179; font-size: 23rpx; }
.chevron { color: #507064; font-size: 34rpx; }
</style>
