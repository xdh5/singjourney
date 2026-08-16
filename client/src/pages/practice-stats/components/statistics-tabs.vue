<template>
  <view class="tabs">
    <view
      class="tab"
      :class="{ active: active === 'week' }"
      @tap="$emit('change', 'week')"
    >{{ weekLabel }}</view>
    <view
      class="tab"
      :class="{ active: active === 'total' }"
      @tap="$emit('change', 'total')"
    >{{ totalLabel }}</view>
  </view>
</template>

<script setup lang="ts">
defineProps<{ active: 'week' | 'total'; weekLabel: string; totalLabel: string }>()
defineEmits<{ change: [value: 'week' | 'total'] }>()
</script>

<style scoped lang="scss">
.tabs {
  display: grid;
  height: 92rpx;
  margin-bottom: 18rpx;
  grid-template-columns: repeat(2, 1fr);
}
.tab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #394c45;
  font-size: 25rpx;
}
.tab.active {
  color: #07964f;
  font-weight: 700;
}
.tab.active::after {
  position: absolute;
  bottom: 8rpx;
  width: 98rpx;
  height: 4rpx;
  border-radius: 2rpx;
  background: #0ca85a;
  content: '';
}
</style>
