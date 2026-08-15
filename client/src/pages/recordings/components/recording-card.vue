<template>
  <view
    class="recording-card"
    :class="{ selected }"
    role="button"
    @tap="emit('select')"
  >
    <view
      v-if="selectionMode"
      class="selection-placeholder"
    >
      <view
        class="recording-checkbox"
        :class="{ checked: selected }"
        >✓</view
      >
    </view>
    <view
      v-else
      class="play-button"
      ><uni-icons
        type="forward"
        :size="22"
        color="#ffffff"
    /></view>
    <view class="recording-copy">
      <text class="recording-name">{{ name }}</text>
      <view class="recording-date-row">
        <uni-icons
          type="calendar"
          :size="16"
          color="#4e555f"
        />
        <text class="recording-date">{{ date }}</text>
      </view>
    </view>
    <view class="recording-actions">
      <view
        class="recording-menu"
        :class="{ 'selection-hidden': selectionMode }"
        role="button"
        :aria-label="moreLabel"
        @tap.stop="!selectionMode && emit('menu')"
      >
        <uni-icons
          type="more-filled"
          :size="24"
          color="#4e555f"
        />
      </view>
      <text class="recording-duration">{{ duration }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  date: string
  duration: string
  selected: boolean
  selectionMode: boolean
  moreLabel: string
}>()

const emit = defineEmits<{ select: []; menu: [] }>()
</script>

<style scoped lang="scss">
.recording-card {
  position: relative;
  display: flex;
  min-height: 168rpx;
  align-items: center;
  gap: 28rpx;
  padding: 24rpx 30rpx 24rpx 28rpx;
  overflow: hidden;
  border: 1px solid rgba(52, 92, 78, 0.07);
  border-radius: 22rpx;
  box-sizing: border-box;
  background: #fff;
  box-shadow: 0 10rpx 28rpx rgba(48, 78, 67, 0.09);
}
.recording-card.selected {
  background: rgba(255, 255, 255, 0.96);
  box-shadow:
    inset 0 0 0 2rpx $singjourney-green,
    0 15rpx 34rpx rgba(48, 78, 67, 0.11);
}
.play-button {
  display: flex;
  flex: 0 0 76rpx;
  width: 76rpx;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: $singjourney-green;
  box-shadow: 0 8rpx 16rpx rgba(53, 107, 91, 0.25);
}
.selection-placeholder {
  display: flex;
  flex: 0 0 76rpx;
  width: 76rpx;
  height: 76rpx;
  align-items: center;
  justify-content: center;
}
.recording-checkbox {
  display: flex;
  width: 40rpx;
  height: 40rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid $singjourney-green;
  border-radius: 50%;
  box-sizing: border-box;
  color: transparent;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1;
}
.recording-checkbox.checked {
  color: #fff;
  background: $singjourney-green;
}
.recording-copy {
  display: grid;
  min-width: 0;
  flex: 1;
  grid-template-rows: 88rpx 28rpx;
  row-gap: 4rpx;
  align-items: center;
}
.recording-name {
  overflow: hidden;
  color: #17262a;
  font-size: 31rpx;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recording-date-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
}
.recording-date,
.recording-duration {
  color: #4e555f;
  font-size: 22rpx;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.recording-actions {
  display: grid;
  flex: none;
  grid-template-rows: 88rpx 28rpx;
  row-gap: 4rpx;
  align-items: center;
  justify-items: end;
}
.recording-menu {
  display: flex;
  width: 96rpx;
  height: 88rpx;
  align-items: center;
  justify-content: flex-end;
}
.recording-menu.selection-hidden {
  visibility: hidden;
  pointer-events: none;
}
</style>
