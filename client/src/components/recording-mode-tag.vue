<template>
  <view
    class="recording-mode-tag"
    @touchstart.stop
    @touchmove.stop
  >
    <text>{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<style scoped lang="scss">
.recording-mode-tag {
  position: absolute;
  z-index: 4;
  top: 18rpx;
  left: 24rpx;
  display: flex;
  min-width: 112rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  padding: 0 18rpx;
  border: 1px solid #c9ddd5;
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #356b5b;
  background: rgba(255, 255, 255, 0.94);
  font-size: 23rpx;
  font-weight: 700;
}
</style>
