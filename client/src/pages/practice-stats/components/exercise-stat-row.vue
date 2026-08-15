<template>
  <view class="exercise-row sj-card">
    <view class="exercise-icon"
      ><uni-icons
        type="sound-filled"
        :size="24"
        color="#356b5b"
    /></view>
    <view class="exercise-content">
      <view class="exercise-heading">
        <text class="exercise-title">{{ title }}</text>
        <text class="exercise-duration">{{ duration }}</text>
      </view>
      <view class="exercise-meta">
        <text>{{ sessions }}</text>
        <progress
          class="exercise-progress"
          :percent="progress"
          :stroke-width="5"
          active-color="#6f9d8d"
          background-color="#e7efeb"
          :show-info="false"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  duration: string
  sessions: string
  progress: number
}>()
</script>

<style scoped lang="scss">
.exercise-row {
  display: flex;
  align-items: center;
  padding: 20rpx;
}
.exercise-icon {
  display: flex;
  flex: 0 0 66rpx;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: $singjourney-surface;
}
.exercise-content {
  flex: 1;
  min-width: 0;
  margin-left: 17rpx;
}
.exercise-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.exercise-title {
  overflow: hidden;
  color: $singjourney-text-primary;
  font-size: 24rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.exercise-duration {
  flex: none;
  color: $singjourney-green;
  font-size: 22rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.exercise-meta {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-top: 12rpx;
  color: #789087;
  font-size: 19rpx;
}
.exercise-progress {
  min-width: 0;
  flex: 1;
}
</style>
