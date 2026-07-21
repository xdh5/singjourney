<template>
  <practice-session v-if="activeManifest" :manifest="activeManifest" @close="activeManifest = null" />
  <view v-else class="page">
    <view class="practice-principles">
      <text class="principles-title">{{ t('practice.safetyTitle') }}</text>
      <text class="principles-copy">{{ t('practice.safetyCopy') }}</text>
    </view>

    <view class="control-card">
      <view class="control-heading">
        <text class="control-title">{{ t('practice.voicePreset') }}</text>
        <text class="control-value">{{ selectedRange }}</text>
      </view>
      <view class="segmented">
        <view
          v-for="voice in voicePresets"
          :key="voice"
          class="segment"
          :class="{ active: selectedVoice === voice }"
          role="button"
          @tap="selectVoice(voice)"
        >
          {{ t(`practice.voices.${voice}`) }}
        </view>
      </view>

      <view class="fixed-range">{{ t('practice.fixedRange', { range: selectedRange }) }}</view>
    </view>

    <view class="custom-accompaniment-card">
      <view class="custom-accompaniment-icon">
        <text class="custom-accompaniment-note">♪</text>
      </view>
      <view class="custom-accompaniment-content">
        <text class="custom-accompaniment-title">{{ t('practice.customAccompaniment.title') }}</text>
        <text class="custom-accompaniment-description">{{ t('practice.customAccompaniment.description') }}</text>
        <view class="custom-accompaniment-options">
          <view class="custom-option" role="button" @tap="showCustomAccompanimentComingSoon">
            <text class="custom-option-icon">♩</text>
            <text>{{ t('practice.customAccompaniment.playPiano') }}</text>
          </view>
          <view class="custom-option" role="button" @tap="showCustomAccompanimentComingSoon">
            <text class="custom-option-icon">＋</text>
            <text>{{ t('practice.customAccompaniment.uploadAndParse') }}</text>
          </view>
        </view>
      </view>
    </view>

    <scroll-view class="category-scroll" scroll-x :show-scrollbar="false">
      <view class="category-row">
        <view
          v-for="category in categories"
          :key="category"
          class="category-chip"
          :class="{ active: selectedCategory === category }"
          role="button"
          @tap="selectCategory(category)"
        >
          {{ t(`practice.categories.${category}`) }}
        </view>
      </view>
    </scroll-view>

    <view class="section-heading">
      <text class="section-title">{{ t('practice.exerciseList') }}</text>
    </view>

    <view class="exercise-list">
      <view
        v-for="exercise in visibleExercises"
        :key="exercise.id"
        class="exercise-card"
      >
        <view class="exercise-topline">
          <view class="exercise-number">{{ exerciseNumber(exercise.id) }}</view>
          <view class="exercise-heading">
            <text class="exercise-title">{{ t(exercise.titleKey) }}</text>
            <text class="exercise-category">{{ t(`practice.categories.${exercise.category}`) }}</text>
          </view>
        </view>

        <text class="exercise-description">{{ t(exercise.descriptionKey) }}</text>

        <view class="exercise-data">
          <view class="data-cell">
            <text class="data-label">{{ t('practice.pattern') }}</text>
            <text class="data-value pattern">{{ exercise.pattern }}</text>
          </view>
          <view class="data-cell">
            <text class="data-label">{{ t('practice.syllables') }}</text>
            <text class="data-value syllables">{{ exercise.syllables }}</text>
          </view>
        </view>

        <view class="exercise-actions">
          <button class="preview-button" hover-class="none" @tap="previewExercise">
            <text class="preview-icon">▶</text>
            <text>{{ t('practice.preview') }}</text>
          </button>
          <button
            class="start-button"
            :class="{ disabled: !exercise.enabled }"
            :disabled="!exercise.enabled"
            hover-class="none"
            @tap="startExercise(exercise.id)"
          >
            {{ exercise.enabled ? t('practice.startExercise') : t('practice.unavailable') }}
          </button>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { setPageTitle } from './i18n'
import PracticeSession from './practice-session.vue'
import maleManifestJson from './static/practice/connection-mum-octave-v1-male.json'
import femaleManifestJson from './static/practice/connection-mum-octave-v1-female.json'
import type { PracticeManifest } from './shared/practice'
import {
  ENABLED_EXERCISE_ID,
  EXERCISE_CATEGORIES,
  VOCAL_EXERCISES,
  VOICE_PRESET_RANGES,
  type ExerciseCategory,
  type VoicePreset
} from './shared/vocal-exercises'

type CategoryFilter = ExerciseCategory | 'all'

const TOAST_ICON_NONE = 'none' as const

const { t } = useI18n()
const voicePresets: readonly VoicePreset[] = ['male', 'female']
const categories: readonly CategoryFilter[] = ['all', ...EXERCISE_CATEGORIES]
const selectedVoice = ref<VoicePreset>('male')
const selectedCategory = ref<CategoryFilter>('all')
const activeManifest = ref<PracticeManifest | null>(null)

const manifests: Record<VoicePreset, PracticeManifest> = {
  male: maleManifestJson as PracticeManifest,
  female: femaleManifestJson as PracticeManifest
}
const selectedRange = computed(() => VOICE_PRESET_RANGES[selectedVoice.value].label)
const visibleExercises = computed(() => selectedCategory.value === 'all'
  ? VOCAL_EXERCISES
  : VOCAL_EXERCISES.filter(exercise => exercise.category === selectedCategory.value))

onShow(() => setPageTitle('nav.practice'))

function selectVoice(voice: VoicePreset) {
  selectedVoice.value = voice
}

function selectCategory(category: CategoryFilter) {
  selectedCategory.value = category
}

function exerciseNumber(id: string) {
  return String(VOCAL_EXERCISES.findIndex(exercise => exercise.id === id) + 1).padStart(2, '0')
}

function startExercise(id: string) {
  if (id !== ENABLED_EXERCISE_ID) return
  activeManifest.value = manifests[selectedVoice.value]
}

function previewExercise() {
  uni.showToast({ title: t('practice.previewComingSoon'), icon: TOAST_ICON_NONE })
}

function showCustomAccompanimentComingSoon() {
  uni.showToast({ title: t('practice.customAccompaniment.comingSoon'), icon: TOAST_ICON_NONE })
}

</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx 28rpx 64rpx;
  box-sizing: border-box;
  background: #f7faf8;
}

.practice-principles { display: flex; flex-direction: column; padding: 8rpx 2rpx 28rpx; }
.principles-title { color: #294c43; font-size: 32rpx; font-weight: 900; }
.principles-copy { margin-top: 10rpx; color: #526f66; font-size: 23rpx; line-height: 1.6; }

.control-card,
.custom-accompaniment-card,
.exercise-card {
  border: 1px solid #c9ddd5;
  border-radius: 24rpx;
  background: #fff;
}

.control-card { padding: 24rpx; }
.control-heading,
.section-heading,
.exercise-topline { display: flex; align-items: center; }
.control-heading { justify-content: space-between; }
.control-title { color: #294c43; font-size: 25rpx; font-weight: 800; }
.control-value,
.range-note { color: #6b8179; font-size: 22rpx; }

.segmented {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10rpx;
  margin-top: 16rpx;
  padding: 8rpx;
  border-radius: 18rpx;
  background: #edf5f1;
}
.segment {
  display: flex;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 14rpx;
  color: #58766c;
  font-size: 25rpx;
  font-weight: 700;
}
.segment.active { color: #fff; background: #356b5b; }

.fixed-range { margin-top: 18rpx; padding: 18rpx; border-radius: 16rpx; color: #526f66; background: #f4f8f6; font-size: 22rpx; text-align: center; }

.custom-accompaniment-card {
  display: flex;
  margin-top: 18rpx;
  padding: 24rpx;
  background: linear-gradient(135deg, #f3f8f5 0%, #fff 100%);
}
.custom-accompaniment-icon {
  display: flex;
  flex: 0 0 72rpx;
  width: 72rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  color: #fff;
  background: #356b5b;
}
.custom-accompaniment-note { font-size: 38rpx; font-weight: 800; }
.custom-accompaniment-content { display: flex; flex: 1; min-width: 0; flex-direction: column; margin-left: 20rpx; }
.custom-accompaniment-title { color: #294c43; font-size: 27rpx; font-weight: 900; }
.custom-accompaniment-description { margin-top: 8rpx; color: #607b72; font-size: 21rpx; line-height: 1.55; }
.custom-accompaniment-options { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }
.custom-option {
  display: inline-flex;
  min-height: 54rpx;
  align-items: center;
  padding: 0 17rpx;
  border: 1px solid #c9ddd5;
  border-radius: 999rpx;
  color: #356b5b;
  background: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
.custom-option-icon { margin-right: 7rpx; font-size: 23rpx; }

.category-scroll { width: calc(100% + 56rpx); margin: 28rpx -28rpx 0; white-space: nowrap; }
.category-row { display: inline-flex; gap: 12rpx; padding: 0 28rpx; }
.category-chip {
  display: inline-flex;
  height: 62rpx;
  align-items: center;
  padding: 0 25rpx;
  border: 1px solid #c9ddd5;
  border-radius: 999rpx;
  color: #58766c;
  background: #fff;
  font-size: 23rpx;
  font-weight: 700;
}
.category-chip.active { border-color: #356b5b; color: #fff; background: #356b5b; }

.section-heading { margin: 32rpx 2rpx 18rpx; }
.section-title { color: #294c43; font-size: 31rpx; font-weight: 900; }
.exercise-list { display: flex; flex-direction: column; gap: 18rpx; }
.exercise-card { padding: 22rpx; }
.exercise-number {
  display: flex;
  flex: 0 0 60rpx;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: #356b5b;
  background: #edf5f1;
  font-size: 22rpx;
  font-weight: 900;
}
.exercise-heading { display: flex; flex: 1; min-width: 0; flex-direction: column; margin-left: 18rpx; }
.exercise-title { color: #294c43; font-size: 29rpx; font-weight: 900; }
.exercise-category { margin-top: 5rpx; color: #719086; font-size: 21rpx; }
.exercise-description { display: block; margin-top: 18rpx; color: #607b72; font-size: 23rpx; line-height: 1.55; }
.exercise-data { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 18rpx; }
.data-cell { display: flex; min-width: 0; flex-direction: column; padding: 16rpx; border-radius: 16rpx; background: #f4f8f6; }
.data-label { color: #789087; font-size: 19rpx; }
.data-value { margin-top: 7rpx; color: #294c43; font-size: 23rpx; font-weight: 800; }
.data-value.pattern { font-variant-numeric: tabular-nums; }
.data-value.syllables { color: #356b5b; }
.exercise-actions { display: grid; grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr); gap: 12rpx; margin-top: 18rpx; }
.preview-button,
.start-button { width: 100%; height: 72rpx; margin: 0; border-radius: 999rpx; font-size: 25rpx; font-weight: 800; line-height: 72rpx; }
.preview-button { border: 1px solid #b9d2c9; color: #356b5b; background: #fff; }
.preview-button::after,
.start-button::after { border: 0; }
.preview-icon { margin-right: 8rpx; font-size: 20rpx; }
.start-button { color: #fff; background: #356b5b; }
.start-button.disabled { color: #91a59e; background: #e8efec; }
/* #ifdef H5 */
.page { min-height: calc(100vh - var(--window-top) - var(--window-bottom)); }
/* #endif */
</style>
