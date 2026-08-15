<template>
  <view
    class="feature-card"
    role="button"
    @tap="emit('select')"
  >
    <image
      class="feature-card-art"
      :src="art"
      mode="aspectFill"
    />
    <view class="feature-card-copy">
      <text class="feature-card-title">{{ title }}</text>
      <text class="feature-card-description">{{ description }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  art: string
  title: string
  description: string
}>()

const emit = defineEmits<{ select: [] }>()
</script>

<style scoped lang="scss">
.feature-card {
  position: relative;
  width: 100%;
  height: 252rpx;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 28rpx;
  background: #f5fbf8;
  box-shadow: 0 12rpx 26rpx rgba(48, 78, 67, 0.12);
}
.feature-card-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.feature-card-copy {
  position: absolute;
  z-index: 2;
  top: 32rpx;
  left: 28rpx;
  display: flex;
  width: 146rpx;
  flex-direction: column;
  color: $singjourney-green-dark;
}
.feature-card-title {
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.15;
}
.feature-card-description {
  margin-top: 14rpx;
  font-size: 23rpx;
  line-height: 1.45;
}
</style>
