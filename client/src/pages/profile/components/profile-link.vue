<template>
  <view
    class="profile-link"
    role="button"
    @tap="emit('select')"
  >
    <view class="link-icon">
      <view
        v-if="icon === 'statistics'"
        class="statistics-icon"
        aria-hidden="true"
      >
        <view class="statistics-bar short" />
        <view class="statistics-bar medium" />
        <view class="statistics-bar tall" />
        <view class="statistics-bar middle" />
      </view>
      <uni-icons
        v-else
        :type="icon"
        :size="24"
        color="#0f4d3b"
      />
    </view>
    <view class="link-copy">
      <text class="link-title">{{ title }}</text>
      <text class="link-description">{{ description }}</text>
    </view>
    <uni-icons
      type="right"
      :size="20"
      color="#789088"
    />
  </view>
</template>

<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
}>()

const emit = defineEmits<{ select: [] }>()
</script>

<style scoped lang="scss">
.profile-link {
  display: flex;
  min-height: 126rpx;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  border: 1px solid rgba(52, 92, 78, 0.1);
  border-radius: 26rpx;
  box-sizing: border-box;
  background: #fff;
  box-shadow: 0 10rpx 24rpx rgba(48, 78, 67, 0.08);
}

.link-icon {
  display: flex;
  flex: 0 0 68rpx;
  width: 68rpx;
  height: 68rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  background: #e4f3ec;
}

.statistics-icon {
  display: flex;
  width: 38rpx;
  height: 38rpx;
  align-items: flex-end;
  justify-content: center;
  gap: 4rpx;
}

.statistics-bar {
  width: 6rpx;
  border-radius: 5rpx 5rpx 2rpx 2rpx;
  background: $singjourney-green-dark;
}

.statistics-bar.short {
  height: 15rpx;
}

.statistics-bar.medium {
  height: 25rpx;
}

.statistics-bar.tall {
  height: 36rpx;
}

.statistics-bar.middle {
  height: 21rpx;
}

.link-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.link-title {
  color: $singjourney-text-primary;
  font-size: 28rpx;
  font-weight: 900;
}

.link-description {
  margin-top: 7rpx;
  color: $singjourney-text-muted;
  font-size: 21rpx;
}
</style>
