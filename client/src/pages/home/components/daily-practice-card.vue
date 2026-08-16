<template>
  <view
    class="record-card"
    role="button"
    @tap="emit('select')"
  >
    <image
      class="record-card-art"
      :src="dailyPracticeHero"
      mode="aspectFill"
    />
    <view class="record-recommendation">
      <app-icon
        name="favorite"
        :size="15"
        tone="yellow"
      />
      <text class="recommendation-label">{{ t('home.recommended') }}</text>
    </view>
    <view class="record-copy">
      <text class="record-title">{{ t('home.dailyPracticeTitle') }}</text>
      <text class="record-description">{{ description }}</text>
    </view>
    <view class="practice-progress">
      <app-icon name="trend-up" :size="14" tone="accent" />
      <text class="progress-label">{{ t('home.todayPracticedPrefix') }}</text>
      <text class="progress-value">{{ todayMinutes }}</text>
      <text class="progress-unit">{{ t('home.minutesUnit') }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '../../../components/app-icon.vue'
import dailyPracticeHero from '../../../assets/home/daily-practice-hero.jpg'

defineProps<{ description: string; todayMinutes: number }>()
const emit = defineEmits<{ select: [] }>()
const { t } = useI18n()
</script>

<style scoped lang="scss">
.record-card {
  position: relative;
  width: 100%;
  height: 262rpx;
  margin-top: 16rpx;
  overflow: hidden;
  border-radius: 38rpx;
  background: $singjourney-green-card;
  box-shadow: 0 20rpx 34rpx rgba(25, 76, 59, 0.19);
}
.record-card-art {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.record-recommendation {
  position: absolute;
  z-index: 2;
  top: 22rpx;
  left: 29rpx;
  display: inline-flex;
  min-width: 103rpx;
  height: 47rpx;
  align-items: center;
  gap: 8rpx;
  padding: 0 18rpx 0 13rpx;
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #fff;
  background: rgba(116, 195, 165, 0.72);
  white-space: nowrap;
}
.recommendation-label {
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1;
}
.record-copy {
  position: absolute;
  z-index: 2;
  top: 94rpx;
  left: 34rpx;
  display: flex;
  max-width: 330rpx;
  flex-direction: column;
  color: #fff;
  text-shadow: 0 2rpx 10rpx rgba(6, 47, 35, 0.26);
}
.record-title {
  font-size: 44rpx;
  font-weight: 900;
  line-height: 1.15;
}
.record-description {
  margin-top: 12rpx;
  font-size: 22rpx;
  line-height: 1.4;
}
.practice-progress {
  position: absolute;
  z-index: 3;
  right: 23rpx;
  bottom: 18rpx;
  display: flex;
  min-width: 185rpx;
  height: 36rpx;
  align-items: center;
  justify-content: center;
  gap: 5rpx;
  padding: 0 13rpx;
  border-radius: 999rpx;
  box-sizing: border-box;
  color: #fff;
  background: rgba(8, 112, 78, 0.84);
  box-shadow: 0 8rpx 20rpx rgba(0, 37, 25, 0.18);
}
.progress-label,
.progress-unit {
  font-size: 18rpx;
  font-weight: 600;
  line-height: 1;
}
.progress-value {
  color: #ffd82d;
  font-size: 21rpx;
  font-weight: 900;
  line-height: 1;
}
</style>
