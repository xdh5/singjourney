<template>
  <app-navbar title-key="nav.practiceRecordings" />
  <view class="page">
    <uni-notice-bar
      :text="t('practiceRecordings.localNotice')"
      show-icon
      background-color="#edf5f1"
      color="#416b5d"
    />
    <view class="empty-state">
      <view class="empty-icon"
        ><uni-icons
          type="sound-filled"
          :size="34"
          color="#356b5b"
      /></view>
      <text class="empty-title">{{ t('practiceRecordings.empty') }}</text>
      <text class="empty-copy">{{ t('practiceRecordings.emptyDescription') }}</text>
      <button
        class="practice-button"
        hover-class="none"
        @tap="openPractice"
      >
        {{ t('practiceRecordings.start') }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import AppNavbar from '../../components/app-navbar.vue'
import { setPageTitle } from '../../i18n'

const { t } = useI18n()
onShow(() => setPageTitle('nav.practiceRecordings'))

function openPractice() {
  uni.navigateTo({ url: '/pages/practice/index', animationType: 'none', animationDuration: 0 })
}
</script>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 36px - env(safe-area-inset-top));
  padding: 28rpx;
  box-sizing: border-box;
  background: #f7faf8;
}
.empty-state {
  display: flex;
  align-items: center;
  padding: 150rpx 36rpx 60rpx;
  flex-direction: column;
}
.empty-icon {
  display: flex;
  width: 108rpx;
  height: 108rpx;
  align-items: center;
  justify-content: center;
  border-radius: 32rpx;
  background: #e7f0ec;
}
.empty-title {
  margin-top: 30rpx;
  color: #294c43;
  font-size: 30rpx;
  font-weight: 900;
}
.empty-copy {
  margin-top: 10rpx;
  color: #718980;
  font-size: 22rpx;
  text-align: center;
}
.practice-button {
  height: 74rpx;
  margin-top: 34rpx;
  padding: 0 42rpx;
  border-radius: 999rpx;
  color: #fff;
  background: #356b5b;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 74rpx;
}
</style>
