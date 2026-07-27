<template>
  <view class="page">
    <view class="hero-heading">
      <image class="heading-curve" src="/static/home/pitch-heading-curve.png" mode="aspectFit" />
      <view class="heading-copy">
        <text class="product-name">{{ t('app.name') }}</text>
        <text class="product-subtitle">{{ t('miniProgram.pitchSubtitle') }}</text>
      </view>
    </view>

    <view class="record-card" role="button" @tap="open('/record')">
      <image class="record-card-art" src="/static/home/pitch-recording-hero.jpg" mode="aspectFill" />
      <view class="record-copy">
        <text class="record-title">{{ t('home.freeRecording') }}</text>
        <text class="record-description">{{ t('home.freeRecordingDescription') }}</text>
      </view>
    </view>

    <view class="recordings-card" role="button" @tap="open('/recordings')">
      <image class="recordings-art" src="/static/home/recordings-play.png" mode="aspectFit" />
      <view class="recordings-copy">
        <text class="recordings-title">{{ t('home.recordings') }}</text>
        <text class="recordings-description">{{ t('home.recordingsDescription') }}</text>
      </view>
      <view class="recordings-arrow">›</view>
    </view>

    <view class="advertising-reserve" aria-hidden="true" />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'

const { t } = useI18n()
onShow(() => setPageTitle('app.name'))

function open(url: string) {
  uni.navigateTo({ url, animationType: 'none', animationDuration: 0 })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: calc(var(--status-bar-height) + 128rpx) 30rpx calc(env(safe-area-inset-bottom) + 28rpx);
  box-sizing: border-box;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 85% 19%, rgba(196, 225, 211, 0.27), transparent 29%),
    linear-gradient(180deg, #fdfefc 0%, #fafbf9 100%);
}
.hero-heading { position: relative; display: flex; min-height: 220rpx; align-items: center; }
.heading-curve {
  position: absolute;
  z-index: 0;
  top: -42rpx;
  right: -56rpx;
  width: 390rpx;
  height: 322rpx;
  opacity: 0.82;
}
.heading-copy { position: relative; z-index: 1; display: flex; max-width: 610rpx; flex-direction: column; }
.product-name { color: $singjourney-green-dark; font-size: 68rpx; font-weight: 900; letter-spacing: 2rpx; line-height: 1.08; }
.product-subtitle { margin-top: 25rpx; color: $singjourney-text-secondary; font-size: 27rpx; line-height: 1.45; }

.record-card {
  position: relative;
  height: 450rpx;
  margin-top: 48rpx;
  overflow: hidden;
  border-radius: 38rpx;
  background: $singjourney-green-card;
  box-shadow: 0 20rpx 34rpx rgba(25, 76, 59, 0.19);
}
.record-card-art { position: absolute; inset: 0; width: 100%; height: 100%; }
.record-copy {
  position: absolute;
  z-index: 2;
  top: 137rpx;
  left: 34rpx;
  display: flex;
  max-width: 360rpx;
  flex-direction: column;
  color: #fff;
  text-shadow: 0 2rpx 10rpx rgba(6, 47, 35, 0.26);
}
.record-title { font-size: 48rpx; font-weight: 900; line-height: 1.15; }
.record-description { margin-top: 22rpx; font-size: 27rpx; line-height: 1.45; }

.recordings-card {
  position: relative;
  display: flex;
  min-height: 204rpx;
  margin-top: 32rpx;
  align-items: center;
  overflow: hidden;
  border: 1px solid rgba(52, 92, 78, 0.1);
  border-radius: 36rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 15rpx 34rpx rgba(48, 78, 67, 0.11);
}
.recordings-art { flex: 0 0 252rpx; width: 252rpx; height: 160rpx; margin-left: 12rpx; }
.recordings-copy {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  margin-left: -4rpx;
  padding-right: 100rpx;
}
.recordings-title { color: $singjourney-text-primary; font-size: 37rpx; font-weight: 900; }
.recordings-description { margin-top: 14rpx; color: $singjourney-text-muted; font-size: 25rpx; line-height: 1.35; }
.recordings-arrow {
  position: absolute;
  right: 38rpx;
  display: flex;
  width: 61rpx;
  height: 61rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: $singjourney-green-card;
  background: #eff4f1;
  font-family: Arial, sans-serif;
  font-size: 50rpx;
  font-weight: 300;
  line-height: 1;
}
.advertising-reserve { min-height: 300rpx; }

/* #ifdef H5 */
.page {
  min-height: calc(100vh - var(--window-top) - var(--window-bottom));
  padding-top: 112rpx;
}
/* #endif */

@media (min-width: 768px) {
  .page { max-width: 820px; margin: 0 auto; }
}
</style>
