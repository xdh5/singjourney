<template>
  <view class="page">
    <view class="notice">
      <text class="notice-title">{{ t('practiceRecordings.localNotice') }}</text>
      <text class="notice-copy">{{ t('practiceRecordings.wechatNotice') }}</text>
    </view>
    <view class="empty-state">
      <view class="empty-icon"><view class="empty-bars"><view /><view /><view /></view></view>
      <text class="empty-title">{{ t('practiceRecordings.empty') }}</text>
      <text class="empty-copy">{{ t('practiceRecordings.emptyDescription') }}</text>
      <button class="practice-button" hover-class="none" @tap="openPractice">{{ t('practiceRecordings.start') }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'

const { t } = useI18n()
onShow(() => setPageTitle('nav.practiceRecordings'))

function openPractice() {
  uni.navigateTo({ url: '/practice', animationType: 'none', animationDuration: 0 })
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 28rpx; box-sizing: border-box; background: #f7faf8; }
.notice { display: flex; padding: 22rpx; border: 1px solid #c9ddd5; border-radius: 22rpx; flex-direction: column; background: #edf5f1; }
.notice-title { color: #294c43; font-size: 25rpx; font-weight: 900; }
.notice-copy { margin-top: 8rpx; color: #607b72; font-size: 21rpx; line-height: 1.55; }
.empty-state { display: flex; align-items: center; padding: 150rpx 36rpx 60rpx; flex-direction: column; }
.empty-icon { display: flex; width: 108rpx; height: 108rpx; align-items: center; justify-content: center; border-radius: 32rpx; background: #e7f0ec; }
.empty-bars { display: flex; height: 46rpx; align-items: flex-end; gap: 8rpx; }
.empty-bars view { width: 9rpx; border-radius: 9rpx; background: #356b5b; }
.empty-bars view:nth-child(1) { height: 26rpx; }
.empty-bars view:nth-child(2) { height: 46rpx; }
.empty-bars view:nth-child(3) { height: 34rpx; }
.empty-title { margin-top: 30rpx; color: #294c43; font-size: 30rpx; font-weight: 900; }
.empty-copy { margin-top: 10rpx; color: #718980; font-size: 22rpx; text-align: center; }
.practice-button { height: 74rpx; margin-top: 34rpx; padding: 0 42rpx; border-radius: 999rpx; color: #fff; background: #356b5b; font-size: 24rpx; font-weight: 800; line-height: 74rpx; }
</style>
