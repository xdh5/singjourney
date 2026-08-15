<template>
  <view
    class="page-heading"
    :class="{ compact }"
  >
    <image
      class="heading-curve"
      :src="pitchHeadingCurve"
      mode="aspectFit"
    />
    <view class="heading-copy">
      <text class="heading-title">{{ title }}</text>
      <text class="heading-subtitle">{{ subtitle }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import pitchHeadingCurve from '../assets/home/pitch-heading-curve.svg'

withDefaults(defineProps<{ title: string; subtitle: string; compact?: boolean }>(), {
  compact: false
})
</script>

<style scoped lang="scss">
.page-heading {
  position: relative;
  display: flex;
  min-height: 156rpx;
  align-items: center;
}
.heading-curve {
  position: absolute;
  z-index: 0;
  top: 8rpx;
  right: -4rpx;
  width: 320rpx;
  height: 180rpx;
  opacity: 0.82;
}
.heading-copy {
  position: relative;
  z-index: 1;
  display: flex;
  max-width: 610rpx;
  flex-direction: column;
  padding-left: 10rpx;
}
.heading-title {
  color: $singjourney-green-dark;
  font-size: 56rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
  line-height: 1.08;
}
.heading-subtitle {
  margin-top: 12rpx;
  color: $singjourney-text-secondary;
  font-size: 23rpx;
  line-height: 1.4;
}
.page-heading.compact .heading-title {
  font-size: 46rpx;
  letter-spacing: 1rpx;
}
.page-heading.compact .heading-subtitle {
  margin-top: 22rpx;
}
</style>
