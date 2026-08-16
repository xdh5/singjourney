<template>
  <view class="metric">
    <view class="value-line">
      <text class="value">{{ value }}</text>
      <text class="unit">{{ unit }}</text>
    </view>
    <text class="label">{{ label }}</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{ value: string | number; unit: string; label: string }>()
</script>

<style scoped lang="scss">
.metric {
  position: relative;
  min-width: 0;
  text-align: center;
}
.metric + .metric::before {
  position: absolute;
  left: 0;
  top: 10rpx;
  width: 1px;
  height: 48rpx;
  background: #dce6e2;
  content: '';
}
.value-line {
  white-space: nowrap;
}
.value {
  color: #10241f;
  font-size: 35rpx;
  font-weight: 800;
}
.unit {
  margin-left: 6rpx;
  font-size: 18rpx;
}
.label {
  display: block;
  margin-top: 7rpx;
  overflow: hidden;
  color: #64766f;
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
