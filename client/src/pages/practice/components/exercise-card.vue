<template>
  <view class="exercise-card sj-card">
    <view class="card-heading">
      <text class="exercise-title">{{ exercise.title }}</text>
      <view class="category-list">
        <text
          v-for="categoryName in exercise.category_names"
          :key="categoryName"
          class="category-pill"
        >
          {{ categoryName }}
        </text>
      </view>
      <view class="icon-button info-button" role="button" @tap="showTip">
        <uni-icons type="info" :size="19" color="#657a73" />
      </view>
      <view class="icon-button bookmark-button" role="button" @tap="emit('toggleBookmark', exercise.id)">
        <uni-icons
          :type="bookmarked ? 'star-filled' : 'star'"
          :size="23"
          :color="bookmarked ? '#16845f' : '#657a73'"
        />
      </view>
    </view>

    <view class="divider" />

    <view class="card-details">
      <view class="detail-group pattern-group">
        <view class="detail-icon note-icon">♪</view>
        <view class="detail-copy">
          <text class="detail-value pattern">{{ exercise.pattern }}</text>
        </view>
      </view>
      <view class="vertical-divider" />
      <view class="detail-group syllable-group">
        <view class="detail-icon sound-icon">
          <text>▮</text><text>▮</text><text>▮</text>
        </view>
        <view class="detail-copy">
          <text class="detail-value">{{ exercise.recommended_syllables }}</text>
        </view>
      </view>
      <view
        class="start-button sj-button sj-button-primary"
        :class="{ disabled: !exercise.enabled }"
        role="button"
        :aria-disabled="!exercise.enabled"
        :aria-label="t('practice.startExercise')"
        @tap="startExercise"
      >
        <view class="play-triangle" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PracticeExercise } from '../../../services/practice/catalog'

const props = defineProps<{ exercise: PracticeExercise; bookmarked: boolean }>()
const emit = defineEmits<{ start: [id: string]; toggleBookmark: [id: string] }>()
const { t } = useI18n()

function showTip() {
  uni.showModal({
    title: props.exercise.title,
    content: props.exercise.tip,
    showCancel: false,
    confirmText: t('practice.gotIt')
  })
}

function startExercise() {
  if (props.exercise.enabled) emit('start', props.exercise.id)
}
</script>

<style scoped lang="scss">
.exercise-card {
  padding: 18rpx 28rpx 16rpx;
  border-color: #dce8e3;
  border-radius: 28rpx;
  box-shadow: 0 12rpx 30rpx rgba(32, 77, 63, 0.08);
}
.card-heading {
  display: flex;
  min-height: 44rpx;
  align-items: center;
}
.exercise-title {
  flex: none;
  color: $singjourney-text-primary;
  font-size: 31rpx;
  font-weight: 900;
}
.category-list {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 7rpx;
  margin-left: 18rpx;
}
.category-pill {
  padding: 8rpx 17rpx;
  border-radius: 999rpx;
  color: #23725a;
  background: #edf6f2;
  font-size: 19rpx;
  font-weight: 700;
}
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
}
.info-button {
  width: 52rpx;
  height: 52rpx;
  margin-left: 8rpx;
}
.bookmark-button {
  width: 58rpx;
  height: 58rpx;
  margin-left: auto;
}
.divider {
  height: 1px;
  margin-top: 10rpx;
  background: #e3ece8;
}
.card-details {
  display: flex;
  min-height: 64rpx;
  align-items: center;
  padding-top: 8rpx;
}
.detail-group {
  display: flex;
  min-width: 0;
  align-items: center;
}
.pattern-group { flex: 0 0 300rpx; }
.syllable-group { flex: 1; }
.detail-icon {
  display: flex;
  flex: 0 0 52rpx;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #176a52;
  background: #eef6f2;
}
.note-icon {
  font-size: 37rpx;
  font-weight: 900;
}
.sound-icon {
  gap: 3rpx;
  font-size: 11rpx;
}
.sound-icon text:nth-child(1) { transform: scaleY(1.2); }
.sound-icon text:nth-child(2) { transform: scaleY(2); }
.sound-icon text:nth-child(3) { transform: scaleY(1.5); }
.detail-copy {
  display: flex;
  min-width: 0;
  margin-left: 15rpx;
}
.detail-value {
  overflow: hidden;
  color: $singjourney-text-primary;
  font-size: 21rpx;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pattern {
  overflow: visible;
  font-variant-numeric: tabular-nums;
  text-overflow: clip;
}
.vertical-divider {
  width: 1px;
  height: 48rpx;
  margin: 0 24rpx;
  background: #e3ece8;
}
.start-button {
  flex: 0 0 64rpx;
  width: 64rpx;
  height: 64rpx;
  min-width: 64rpx;
  margin: 0 0 0 18rpx;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: #fff;
  background: #356b5b;
  box-shadow: 0 8rpx 18rpx rgba(28, 116, 86, 0.2);
  line-height: 64rpx;
}
.start-button.disabled { opacity: 0.42; }
.play-triangle {
  display: block;
  width: 0;
  height: 0;
  margin-left: 4rpx;
  border-top: 10rpx solid transparent;
  border-bottom: 10rpx solid transparent;
  border-left: 16rpx solid #fff;
}
</style>
