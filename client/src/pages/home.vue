<template>
  <view class="page">
    <view class="header">
      <text class="title">{{ t('app.name') }}</text>
      <text class="subtitle">{{ t('home.subtitle') }}</text>
    </view>

    <view class="card primary" hover-class="none" role="button" @tap="open('/pages/record')">
      <view class="card-icon"><view class="record-dot" /></view>
      <view class="copy">
        <text class="card-title">{{ t('home.freeRecording') }}</text>
        <text class="small">{{ t('home.freeRecordingDescription') }}</text>
      </view>
      <text class="chevron">›</text>
    </view>

    <view class="card" hover-class="none" role="button" @tap="open('/pages/recordings')">
      <view class="card-icon"><view class="play-triangle" /></view>
      <view class="copy">
        <text class="card-title">{{ t('home.recordings') }}</text>
        <text class="small">{{ t('home.recordingsDescription') }}</text>
      </view>
      <text class="chevron">›</text>
    </view>

    <view class="card upcoming" hover-class="none" role="button" @tap="showComingSoon('home.accompaniment')">
      <view class="card-icon secondary-icon"><text class="music-note">♪</text></view>
      <view class="copy">
        <text class="card-title">{{ t('home.accompaniment') }}</text>
        <text class="small">{{ t('home.accompanimentDescription') }}</text>
      </view>
      <text class="coming-badge">{{ t('home.comingSoon') }}</text>
    </view>

    <view class="card upcoming" hover-class="none" role="button" @tap="showComingSoon('home.practiceRecords')">
      <view class="card-icon secondary-icon"><view class="practice-bars"><view /><view /><view /></view></view>
      <view class="copy">
        <text class="card-title">{{ t('home.practiceRecords') }}</text>
        <text class="small">{{ t('home.practiceRecordsDescription') }}</text>
      </view>
      <text class="coming-badge">{{ t('home.comingSoon') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from '../i18n'

const { t } = useI18n()

onShow(() => setPageTitle('nav.home'))

function open(url: string) {
  uni.navigateTo({ url, animationType: 'none', animationDuration: 0 })
}

function showComingSoon(nameKey: string) {
  uni.showToast({ title: t('home.comingSoonToast', { name: t(nameKey) }), icon: 'none' })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 36rpx 0 40rpx;
  box-sizing: border-box;
  background: #fff;
}

/* #ifdef H5 */
.page { min-height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */

.header {
  display: flex;
  flex-direction: column;
  margin-bottom: 48rpx;
  padding: 0 28rpx;
}

.title {
  color: #356b5b;
  font-size: 48rpx;
  font-weight: 900;
}

.subtitle {
  margin-top: 12rpx;
  color: #6b8179;
  font-size: 27rpx;
}

.card {
  display: flex;
  min-height: 144rpx;
  align-items: center;
  gap: 24rpx;
  margin: 20rpx 28rpx;
  padding: 20rpx 26rpx;
  box-sizing: border-box;
  border: 1px solid #c9ddd5;
  border-radius: 24rpx;
  color: #294c43;
  background: #f7faf8;
}

.card.primary {
  border-color: #5b8e7d;
  background: #edf5f1;
}

.card.upcoming { background: #fbfcfb; }

.card-icon {
  display: flex;
  flex: 0 0 82rpx;
  width: 82rpx;
  height: 82rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #356b5b;
}

.record-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #fff;
}

.play-triangle {
  width: 0;
  height: 0;
  margin-left: 6rpx;
  border-top: 14rpx solid transparent;
  border-bottom: 14rpx solid transparent;
  border-left: 22rpx solid #fff;
}

.secondary-icon { background: #6f9487; }
.music-note { color: #fff; font-size: 46rpx; font-weight: 700; }
.practice-bars { display: flex; height: 38rpx; align-items: flex-end; gap: 7rpx; }
.practice-bars view { width: 8rpx; border-radius: 8rpx; background: #fff; }
.practice-bars view:nth-child(1) { height: 20rpx; }
.practice-bars view:nth-child(2) { height: 38rpx; }
.practice-bars view:nth-child(3) { height: 28rpx; }

.copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
}

.card-title { font-size: 32rpx; font-weight: 800; }
.small { margin-top: 8rpx; color: #6b8179; font-size: 24rpx; }
.chevron { color: #507064; font-size: 34rpx; }
.coming-badge { flex: none; padding: 8rpx 14rpx; border-radius: 999rpx; color: #6b8179; background: #edf3f0; font-size: 21rpx; }
</style>
