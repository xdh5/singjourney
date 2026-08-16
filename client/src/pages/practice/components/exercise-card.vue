<template>
  <view
    class="exercise-card sj-card"
    :class="{ disabled: !exercise.enabled }"
    role="button"
    :aria-disabled="!exercise.enabled"
    :aria-label="exercise.enabled ? t('practice.startExercise') : exercise.title"
    @tap="startExercise"
  >
    <view class="card-heading">
      <text class="exercise-title">{{ exercise.title }}</text>
      <view class="icon-button info-button" role="button" @tap.stop="showTip">
        <app-icon name="info" :size="18" tone="muted" />
      </view>
      <view
        class="icon-button bookmark-button"
        role="button"
        @tap.stop="emit('toggleBookmark', exercise.id)"
      >
        <app-icon
          name="favorite"
          :size="23"
          :tone="bookmarked ? 'yellow' : 'muted'"
        />
      </view>
    </view>

    <view class="card-details">
      <text
        class="pattern"
        :class="{ compact: exercise.pattern.length > 21 }"
      >
        {{ exercise.pattern }}
      </text>
      <view class="category-list">
        <text
          v-for="categoryName in exercise.category_names"
          :key="categoryName"
          class="category-pill"
        >
          {{ categoryName }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '../../../components/app-icon.vue'
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
  padding: 24rpx 30rpx 22rpx;
  border-color: #dce8e3;
  border-radius: 28rpx;
  box-shadow: 0 12rpx 30rpx rgba(32, 77, 63, 0.08);
}
.exercise-card.disabled { opacity: 0.62; }
.card-heading {
  display: flex;
  min-height: 54rpx;
  align-items: center;
}
.exercise-title {
  min-width: 0;
  flex: 1;
  color: $singjourney-text-primary;
  font-size: 31rpx;
  font-weight: 900;
}
.icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
}
.info-button {
  width: 52rpx;
  height: 52rpx;
  margin-left: 16rpx;
}
.bookmark-button {
  width: 58rpx;
  height: 58rpx;
  margin-left: auto;
}
.card-details {
  display: flex;
  min-height: 46rpx;
  align-items: center;
  gap: 18rpx;
  padding-top: 6rpx;
}
.pattern {
  min-width: 0;
  flex: 1;
  color: #258b6b;
  font-size: 25rpx;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.pattern.compact { font-size: 20rpx; }
.category-list {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 7rpx;
}
.category-pill {
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  color: #23725a;
  background: #edf6f2;
  font-size: 18rpx;
  font-weight: 700;
  white-space: nowrap;
}
</style>
