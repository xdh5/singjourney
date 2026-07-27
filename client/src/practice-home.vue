<template>
  <view class="page">
    <view class="hero">
      <text class="eyebrow">{{ t('miniProgram.practiceEyebrow') }}</text>
      <text class="title">{{ t('miniProgram.practiceTitle') }}</text>
      <text class="subtitle">{{ t('miniProgram.practiceSubtitle') }}</text>
    </view>
    <view class="section-heading">{{ t('miniProgram.practiceToday') }}</view>
    <view class="entries">
      <home-entry-card
        :title="t('home.accompaniment')"
        :description="t('home.accompanimentDescription')"
        icon="music"
        primary
        @open="open('/practice')"
      />
      <home-entry-card
        :title="t('home.practiceRecordings')"
        :description="t('home.practiceRecordingsDescription')"
        icon="play"
        @open="open('/practice-recordings')"
      />
      <home-entry-card
        :title="t('home.practiceRecords')"
        :description="t('home.practiceRecordsDescription')"
        icon="stats"
        @open="open('/practice-stats')"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import HomeEntryCard from './components/home-entry-card.vue'
import { setPageTitle } from './i18n'

const { t } = useI18n()
onShow(() => setPageTitle('miniProgram.practiceTitle'))

function open(url: string) {
  uni.navigateTo({ url, animationType: 'none', animationDuration: 0 })
}
</script>

<style scoped>
.page { min-height: 100vh; padding: 30rpx 28rpx 56rpx; box-sizing: border-box; background: #f7faf8; }
.hero { display: flex; padding: 32rpx 28rpx; border-radius: 28rpx; flex-direction: column; background: #356b5b; }
.eyebrow { color: #cfe2db; font-size: 21rpx; font-weight: 700; }
.title { margin-top: 8rpx; color: #fff; font-size: 42rpx; font-weight: 900; }
.subtitle { margin-top: 12rpx; color: #deebe6; font-size: 24rpx; line-height: 1.55; }
.section-heading { margin: 30rpx 2rpx 18rpx; color: #294c43; font-size: 28rpx; font-weight: 900; }
.entries { display: flex; flex-direction: column; gap: 18rpx; }
</style>
